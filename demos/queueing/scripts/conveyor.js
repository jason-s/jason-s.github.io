define([], function() {
    function slide(t, k)
    {
        /* polynomial that maps [0,1] to [0,1] nonlinearly */ 
        var u = (k*t) % 1;
        var tq = k*t - u;
        var v = Math.min(1,Math.max(0,u));
        return v*v*(3-2*v) + tq;
    }
    function Model(id, options)
    {
        this.id = id;
        this.items = [];
        this.x1 = options.x1;
        this.y1 = options.y1;
        this.x2 = options.x2;
        this.y2 = options.y2;
        this.v = options.v;
        this.acceleration = options.acceleration;
        var dx = options.x2-options.x1;
        var dy = options.y2-options.y1;
        this.L = Math.sqrt(dx*dx+dy*dy);
        this.vx = dx/this.L;
        this.vy = dy/this.L;
        this.target = null;
        this.specs = {
            insertRate: 1,
            velocity: options.v,
            acceleration: options.acceleration,
            startPos: (options.startPos == null) ? -1 : options.startPos,
            endPos: (options.endPos == null) ? 0 : options.endPos,
        };
        this.phase = 0;
        this.out = {
            enable: true,
            active: false,
            t0:     0,
            count0:     0,
        }
        this.count = 0;
        this.onEntry = options.onEntry;
        this.context = options.context || {log:function(op,t,equip,obj){}}
    }
    Model.prototype = {
        log_event: function(op, t, item_model) {
            this.context.log(op, t, this, item_model);
        },
        transferBetweenConveyors: function(other, t) {
            var item = this.items[0];
            if (this.out.enable)
            {
                var me = this;
                return function() { me.transferItem(t); };
            }
        },
        transferItem: function(t) {
            if (!this.target.full())
            {
                var item = this.items.shift();
                this.target.insert(item.model, item.view, t);
            }
        },
        defer_events: function(deferred_events, event) {
            if (event != null)
                deferred_events.push(event);
        },
        update: function(t, dt)
        {
            var deferred_events = [];
            var dxmax = this.v*dt;
            ++this.count;

            var rawLimit = this.L + this.specs.endPos;
            var limit = rawLimit;
            var out = this.out;
            if (this.target instanceof Model)
                limit -= this.target.insertClearance();
                // other conveyors have clearance requirements
            if (this.items.length > 0 && this.target != null)
            {
                var item = this.items[0];
                var v = Math.min(this.v, item.vel);
                var dx = v * dt;
                if (this.target instanceof Model)
                {
                    if (item.pos + dx >= rawLimit)
                    {
                        var event = this.transferBetweenConveyors(this.target, t);
                        this.defer_events(deferred_events, event);
                    }
                }
                else
                {
                    var k = this.target.insertRate();
                    if (k > 0 && item.pos + dx >= limit && out.enable) {
                        if (this.target.full()) {
                            console.log("Hmm");
                        }
    
                        if (!out.active)
                        {
                            out.active = true;
                            out.t0 = t;
                            out.count = this.count;
                        } 
                        var t0elapsed = t - out.t0;
                        var x = slide(t0elapsed, k);
                        if (x >= 1)
                        {
                            out.active = false;
                            this.transferItem(t);
                        }
                        else
                        {
                            limit += x;
                        }
                    }    
                }
            }
            var c = this;
            var lastvel = 0;
            this.items.forEach(function(item, index) {
                var v = item.vel;
                if (v < c.v)
                {
                    if (c.acceleration == null)
                        v = c.v;
                    else {
                        // acceleration proportional to distance to limit
                        // (capped out at specified acceleration)
                        const gap = limit-item.pos;
                        const Ka = 0.125;
                        const accel = c.acceleration * Math.min(1, gap/Ka);
                        v = Math.min(c.v, v + accel*dt);
                    }
                }
                if (index == 0 && out.active) {
                    item.pos = limit;
                }
                else
                {
                    const pos0 = item.pos + v*dt;
                    item.pos = Math.min(limit, pos0);
                    // did we hit the item in front? then slow to its velocity
                    if (pos0 > limit) {
                        v = lastvel;
                    }
                }
                limit = item.pos - 1;
                item.vel = v;
                lastvel = v;
                item.model.x = c.x1 + item.pos*c.vx;
                item.model.y = c.y1 + item.pos*c.vy;
            });
            this.phase = this.v*t;
            return deferred_events;
        },
        insert: function(model, view, t)
        {
            var L = this.items.length;
            var P0 = this.specs.startPos;
            if (L == 0 || this.items[L-1].pos >= P0+1)
            {
                this.items.push({model: model, view: view, pos: P0, vel: 0});
                model.x = this.x1;
                model.y = this.y1;
                if (this.onEntry)
                {
                    this.onEntry(model, this, t, view);
                }
                this.log_event('move',t,model);
                return true;
            }
            else
            {
                return false;
            }
        },
        insertClearance: function() {
            // how much room is needed at the end beyond normal 
            // for conveyor-to-conveyor transfers
            var L = this.items.length;
            return (L==0)
                ? 0
                : Math.max(0,1+this.specs.startPos-this.items[L-1].pos);
        },
        insertRate: function() {
            return null;
        },
        nominalTime: function() {
            return this.L / this.v;
        },
        full: function() {
            var L = this.items.length;
            return (L==0) 
                ? false
                : this.items[L-1].pos < this.specs.startPos+1;
        },
        clear: function()
        {
            var result = this.items;
            this.items = [];
            this.out.active = false;
            return result;
        }
    };

    function hypot(x,y) { 
        return Math.sqrt(x*x + y*y);
    }
    function View(options) {
        this.color = options.color;
        this.centerline_color = options.centerline_color || '#808080';
        this.draw_enable = (options.draw == null) ? true : options.draw;
    }
    View.prototype = {
        draw: function(ctx, model, viewctx) {
            if (viewctx.layer == 'base' && this.draw_enable) {
                this.draw_conveyor(ctx, model, viewctx);
            }
            if (viewctx.layer == 'widget') {
                this.draw_items(ctx, model, viewctx);
            }
        },
        draw_conveyor: function(ctx, model, viewctx) {
            var K = viewctx.scale;
            var x1 = model.x1;
            var y1 = model.y1;
            var x2 = model.x2;
            var y2 = model.y2;
            var w = 1;

            var vx = model.vx;
            var vy = model.vy;
            var L = model.L;
            var px = -vy;
            var py = vx;
            var stripe = 0.3;

            ctx.fillStyle = this.color;
            var zx = 0.5*w*px;
            var zy = 0.5*w*py;
            var phase = model.phase % (2*stripe);
            var Lw = L+w/2;
            function limit(x) { return Math.min(Lw, Math.max(-w/2, x));}
            for (var l = phase-1; l < Lw; l += 2*stripe)
            {
                var iend = limit(l+stripe);
                var istart = limit(l);
                ctx.beginPath();
                ctx.moveTo(K*(x1 + istart*vx + zx), K*(y1 + istart*vy + zy));
                ctx.lineTo(K*(x1 + istart*vx - zx), K*(y1 + istart*vy - zy));
                ctx.lineTo(K*(x1 + iend*vx - zx), K*(y1 + iend*vy - zy));
                ctx.lineTo(K*(x1 + iend*vx + zx), K*(y1 + iend*vy + zy));
                ctx.closePath();
                ctx.fill();
            }
            

            for (var i = -1; i <= 1; ++i) {
                ctx.strokeStyle = (i == 0 ? this.centerline_color : '#000');
                ctx.beginPath();
                ctx.moveTo(K*(x1 - 0.5*w*vx + 0.5*i*w*px), K*(y1 - 0.5*w*vy + 0.5*i*w*py));
                ctx.lineTo(K*(x2 + 0.5*w*vx + 0.5*i*w*px), K*(y2 + 0.5*w*vy + 0.5*i*w*py));
                ctx.stroke();
            }
        },
        draw_items: function(ctx, model, viewctx) {
            model.items.forEach(function(item) {
                item.view.draw(ctx, item.model, viewctx);
            });
        }
    }

    return {
        Model: Model,
        View: View
    }
   
})