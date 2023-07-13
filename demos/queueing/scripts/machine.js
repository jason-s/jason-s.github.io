define(['equipment'],function(equipment) {
    function FIFO()
    {
        this.items = [];
    }
    FIFO.prototype = {
        insert: function(info) { this.items.push(info); },
        peek:   function() { return this.items[0]; },
        remove: function() { return this.items.shift(); },
        empty:  function() { return this.items.length == 0; },
        clear:  function() { 
            var cleared = this.items.slice();
            this.items.length = 0;
            return cleared;
        },
        count:  function() { return this.items.length;},
        update: function(t) { }
    }
    function ConstantTimeGenerator(time) {
        this.time = time;
    }
    ConstantTimeGenerator.prototype = {
        next: function() { 
            return this.time;
        }
    }
    function Generator(options)
    {
        this.items = [];
        this._create = options.create;
        this._policy = options.policy;
        this._state = {prev: 0, next: 0, count: 0};
        this.t = 0;
        if (options.policy.delayGenerator.subscribe) {
            const me = this;
            options.policy.delayGenerator.subscribe(function(delay) { 
                me.schedule_next(delay);
            });
        }
    }
    Generator.prototype = Object.create(FIFO.prototype);
    Generator.prototype.update = function(t,dt) {
        if (t > this._state.next)
        {
            if (this._policy.targetReady && !this._policy.targetReady())
                ;
            else if (this._policy.conwip && !this._policy.conwip.acquire())
                ;
            else {
                const since_prev = this._state.next - this._state.prev;
                var item = this._create(t, this._state.count++);
                if (this._policy.log)
                    console.log("Created %s IAT=%s", item.model, since_prev.toFixed(3));
                this.insert(item);
            }
            // update: set prev scheduled time = next scheduled time... 
            // unless it's behind the current time
            this._state.prev = Math.max(t-0.1, this._state.next);
            this.schedule_next(this._policy.delayGenerator.next());
        }
    }
    Generator.prototype.clear = function() {
        this.items.length = 0;
        this._state.prev = 0;
        this._state.next = 0;
        this._state.count = 0;
    }
    Generator.prototype.schedule_next = function(delay) {
        this._state.next = this._state.prev + delay;
    }

    /*
     * Model of a machine includes three queues:
     * 1. items: a FIFO of items before processing
     * 2. inProcess: a list of items undergoing processing
     * 3. outgoing: if the target object has a nonzero insert rate,
     *    then we let the target dwell.
     */
    function Model(id, options)
    {
        this.id = id;
        this.x = options.x;
        this.y = options.y;
        this.name = options.name;
        this.t = 0;
        this.processed_out = 0;
        var capacity = options.capacity;
        var insertRate = options.insertRate;
        this.active = true;
        this.process = options.process;
        this.specs = {capacity: (capacity == null) ? Infinity : capacity,
                      insertRate: (insertRate == null) ? 1 : insertRate,
                      batchSize: options.batchSize || 1};
        this.items = new FIFO();
        this.context = options.context || {log:function(op,t,equip,obj){}}
        this.inProcess = [];
        this.outgoing = {item: null, exit_start_time: 0, justProcessed: null};
        if (options.ready_to_start)
            this.ready_to_start = options.ready_to_start;
        this.cleanup = options.cleanup || function() {};
        if (this.process)
        {
            console.log("%s=%s: %s", this.id, this, this.process);
        }
    }
    equipment.defineModel(Model, {
        full: function() {
            return this.count() >= this.specs.capacity;
        },
        busy: function() {
            return this.process != null && this.process.started() && !this.process.done();
        },
        ready: function() { // could we start?
            return this.process == null || !this.process.started();
        },
        ready_to_start: function(n, t) { // is it ok to start?
            return n >= this.specs.batchSize
        },
        insert: function(model, view, t) {
            if (this.full())
                return false;
            this.log_event('move', t, model);
            this.items.insert({model:model, view:view});
            return true;
        },
        insertRate: function() {
            return this.full() ? 0 : this.specs.insertRate;
        },
        clear: function() {
            var cleared = this.items.clear();
            if (!cleared)
                cleared = [];

            this.processed_out = 0;
            cleared.push.apply(cleared, this.inProcess);
            this.inProcess = [];
            if (this.process)
                this.process.stop();
            this.outgoing.item = null;
            this.outgoing.justProcessed = null;
            this.cleanup();
            return cleared;
        },
        update: function(t,dt) {
            this.items.update(t,dt);
            this.pull_inputs(t);
            this.process_items(t,dt);
            this.push_outputs(t);
            this.outgoing.justProcessed = null;
            this.t = t;
        },
        process_items: function(t,dt) {
            if (this.process == null)
                return;
            var changed = this.process.update(t,dt);
            if (changed && this.process.done())
            {
                this.log_event_in_items('finish', t);
            }
        },
        log_event: function(op, t, item_model) {
            this.context.log(op, t, this, item_model);
        },
        log_event_in_items: function(op, t) {
            const me = this;
            this.inProcess.forEach(function(item) {
                me.log_event(op, t, item.model);
            });
        },
        pull_inputs: function(t) {
            var pq = this.inProcess;
            if (pq.length >= this.specs.batchSize)
                return;
            // done but not empty? then not ready for more
            if (this.process != null
                && this.process.done()
                && pq.length > 0)
                    return;

            // ready for more!
            var item  = this.items.remove();
            if (item != null)
                pq.push(item);
            
            // Even if we didn't get a new item, check if we can start
            if (this.busy() || !this.ready_to_start(pq.length, t))
                return;

            if (this.process != null)
            {
                this.process.start(t);
                this.log_event_in_items('start', t);
            }
            else
            {
                this.outgoing.justProcessed = item;
            }
        },
        push_outputs: function(t) {
            if (this.process != null && !this.process.done())
                return;

            if (this.inProcess.length == 0)
                return;
            
            var item = this.inProcess[0];
            const target = (this.target instanceof Function)
                           ? this.target(item.model)
                           : this.target;
            
            // No outgoing item? Then time for an item to exit, if it can.
            if (this.outgoing.item == null) {
                if (this.process == null 
                    && this.outgoing.justProcessed == item
                    && this.count() == 1)
                {
                    // Special case, when this is just a queue.
                    // OK to send out an item immediately if the queue was just empty.
                }
                else if (target.insertRate() > 0) {
                    // Outgoing item with finite insert rate
                    this.outgoing.item = item;
                    this.outgoing.exit_start_time = t;
                    return;
                }
                // Otherwise we can go ahead and insert the outgoing item.
            } else {
                // There is already an outgoing item in progress.
                // Check if it's complete.
                const out_progress = (t - this.outgoing.exit_start_time) * target.insertRate();
                if (out_progress < 1)
                    return;
                
                // Woohoo! complete!
                this.outgoing.item = null;
            }
            if (target.insert(item.model, item.view, t))
            {
                var item = this.inProcess.shift();
                ++this.processed_out;
                this.log_event('eject', t, item.model);
                if (this.process != null && this.inProcess.length == 0)
                    this.process.stop();
                // ready to go again, if the inProcess queue is empty
            }
        },
        setup: function(action, data, context) {
            if (action == 'source' && data.type == 'widget')
            {
                const machine = this;
                const target = this.target;
                this.items = new Generator({
                    create: function(t) {
                        const item = context.create.apply(null, arguments);
                        machine.log_event('move', t, item.model);
                        return item;
                    },
                    policy: {delayGenerator: data.delayGenerator 
                                             || new ConstantTimeGenerator(1.0/data.rate),
                             conwip: data.conwip,
                             targetReady: data.backPressure
                               ? function() { return !target.full(); }
                               : null, 
                             log: data.log}
                });
            }
        },
        count: function() {
            return this.items.count() + this.inProcess.length;
        },
        toString: function() {
            return "Machine["+this.name+"]";
        },
        setCapacity: function(capacity) {
            this.specs.capacity = (capacity == null) ? Infinity : capacity;
        }
    });

    function View(options)
    {
        this.width = options.width;
        this.height = options.height;
        this.color = options.color;
        const display_spec = options.display || 'in_process';
        this.get_count_to_show = this.prepare_count_display_function(display_spec);
        this.show_count = (options.show_count == null) ? true : options.show_count;
        this.count_location = options.count_location || 'center';
        this.count_align = options.count_align || 'center';
        switch (this.count_align)
        {
            case 'left':
                this.count_dw = this.width * 0.4;
                break;
            default:
                this.count_dw = this.width * 0.25;
        }
        this.font_scale = options.font_scale || 1.0;
        this.time_fmt = options.time_fmt || function(t) { return t.toFixed(2) };
        this.draw_enable = (options.draw == null) ? true : options.draw;
        this.draw_extra = options.draw_extra;
        this.click = options.click;
    }
    View.prototype = {
        draw: function(ctx, model, viewctx) {
            if (viewctx.layer == 'machine' && this.draw_enable)
                this.draw_machine(ctx, model, viewctx);
        },
        draw_machine: function(ctx, model, viewctx) {

            var color = this.color;
            var K = viewctx.scale;
            if (color instanceof Function)
            {
                color = color(model);
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            var w = this.width;
            var h = this.height;
            ctx.rect(K*(model.x - w/2), K*(model.y - h/2), K*w, K*h);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var font_family = "'Segoe UI', 'Lucida Grande', Arial";
            ctx.font = "12.4px "+font_family;
            ctx.fillText(model.name, K*model.x, K*(model.y + h/2 + 0.25));

            if (this.show_count) {
                var tx = model.x;
                var ty = model.y;
                const dw = this.count_dw;
                switch (this.count_location)
                {
                    case 'SW':
                        tx -= dw;
                        ty += this.height/4;
                        break;
                    case 'NW':
                        tx -= dw;
                        ty -= this.height/4;
                        break;
                    case 'N':
                        ty -= this.height/4;
                        break;
                    case 'NE':
                        tx += dw;
                        ty -= this.height/4;
                        break;
                    default:
                        break;
                }

                var font_scale = this.font_scale;
                function setfont(x) {
                    ctx.font = (K*x*font_scale)+"px "+font_family;
                }
                ctx.textBaseline = 'middle';
                ctx.textAlign = this.count_align;
                setfont(0.5);
                var text = this.get_count_to_show(model);
                ctx.fillText(text, K*tx, K*ty);

                ctx.textAlign = 'center';
                setfont(0.4);
                if (model.busy()) {
                    var elapsed = model.process.elapsed();
                    ctx.fillText(this.time_fmt(elapsed), K*tx, K*(ty + 0.5));
                    var progress = model.process.progress();
                    if (progress != null)
                       ctx.fillText(Math.floor(progress*100)+'%',
                                    K*tx, K*(ty - 0.5));
                }
            }
            if (this.draw_extra) {
                const info = this.draw_extra();
                if (info) {
                    this.draw_text(ctx, model, viewctx, info);
                }
            }
        },
        calc_font: function(viewctx, relfontsize) {
            const K = viewctx.scale;
            const font_family = "'Segoe UI', 'Lucida Grande', Arial";
            return (K*relfontsize*this.font_scale)+"px "+font_family;
        },
        draw_text: function(ctx, model, viewctx, info) {
            const K = viewctx.scale;
            const h = this.height;
            ctx.font = this.calc_font(viewctx, info.relfontsize);
            ctx.textAlign = info.align || 'left';
            ctx.fillText(info.text, K*(model.x + info.x), K*(model.y + info.y));
        },
        prepare_count_display_function: function(display_spec) {
            switch (display_spec) {
                case 'processed':
                    return function(model) { return model.count() + model.processed_out; };
                case 'in_process':
                    return function(model) {
                        var batchinfo = (model.specs.batchSize > 1)
                        ? (" / "+model.specs.batchSize)
                        : "";
                        return model.count() + batchinfo;    
                    };
                default:
                    if (display_spec instanceof Function)
                        return function(model) { return display_spec(); }
                    else
                        return function(model) { return display_spec; }
            }
        },
        hit_test: function(x, y, model, viewctx) {
            const K = viewctx.scale;
            const w = this.width;
            const h = this.height;
            const dx = (x-viewctx.xofs)/K - model.x + w/2;
            const dy = (y-viewctx.yofs)/K - model.y + h/2;
            return (dx > 0 && dx < w && dy > 0 && dy < h);
        }
    }

    /* Distributor: target that forwards to one of several machines */
    function Distributor(options) {
        this.targets = [];
        this.currentIndex = 0;
    }
    equipment.defineModel(Distributor, {
        findFirstAvailableTarget: function(f, defaultValue) {
            const n = this.targets.length;
            const i0 = this.currentIndex;
            for (var i = 0; i < n; ++i) {
                const i1 = (i+i0)%n;
                const target = this.targets[i1];
                const result = f(target, i1);
                if (result != null)
                    return result;
            }
            return defaultValue;
        },
        insert: function(model, view, t) {
            const ifound = this.findFirstAvailableTarget(function(target, i) {
                if (target.ready() && target.insert(model, view, t))
                {
                    return i;
                } 
            });
            if (ifound != null)
            {
                this.currentIndex = ifound;
            }
            return ifound >= 0;
        },
        insertRate: function() {
            return this.findFirstAvailableTarget(function(target, i) {
                const rate = target.insertRate();
                if (rate > 0)
                    return rate;
            }, 0);  // default insert rate of 0, if no output available.
        },
        full: function() {
            /* Full if all of the targets are full or not ready. */
            return this.targets.every(function(target) {
                return target.full() || !target.ready();
            })
        },
        add_target: function(target) {
            this.targets.push(target);
        },
        setup: function(action, data, context) {
            if (action == 'target') {
                this.add_target(data);
            }
        },
        reset: function() {
            this.currentIndex = 0;
        }
    });

    return {Model:Model,
            View:View,
            Distributor:Distributor};
})