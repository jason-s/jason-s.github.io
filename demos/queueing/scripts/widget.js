define([], function() {
    function WidgetModel(id, name)
    {
        this.x = 1;
        this.y = 1;
        this.id = id;
        this.name = name;
        this.cycle = 0;
        this.events = [];
    }
    WidgetModel.prototype = {
        log: function(op, data, t, info) {
            var L = this.events.length;
            if (L > 0)
            {
                // add elapsed time to previous event, if needed
                var lastEvent = this.events[L-1];
                if (lastEvent.length < 4)
                    lastEvent.push(t-lastEvent[0]);
            }
            var event = [t,op,data];
            if (info)
                event.push(info);
            this.events.push(event);
            if (op == 'stop')
            {
                var ev0 = this.events[0];
                var ct=t-ev0[0];
                if (ev0[1] == 'move' && 
                    ev0[2].endsWith('q'))
                {
                    ct += ' ('+(t-this.events[1][0])+' past init queue)';
                }
                // raw processing time
                var rpt = this.events.reduce(function(acc, event) {
                    const type = event[1];
                    return acc + (type == 'start' || type == 'process'
                                  ? event[3] : 0);
                }, 0);
                console.log('%s cycle time=%s (rpt=%f)\n%o',
                            this.name,
                            ct, 
                            rpt,
                            this.events);
            }
        },
        toString: function() { return "Widget "+this.name; }
    }
    function WidgetView(size, R, color)
    {
        this._init(size, R, color);
    }
    WidgetView.prototype = {
        _init(size, R, color) {
            this.L = size/2;
            this.R = R;
            this.color = color;
            var vx = 1;
            var vy = 0;
            var h = Math.sqrt(vx*vx+vy*vy);
            vx /= h;
            vy /= h;
            this.vx = vx;
            this.vy = vy;
        },
        bodyHeight: function() { return this.L; },
        draw: function(ctx, model, viewctx) {
            var K = viewctx.scale;
            var L = this.L;
            var H = this.bodyHeight();
            var R = this.R;
            var rx = L-R;
            var ry = H-R;
            var vx = this.vx;
            var vy = this.vy;
            var zx = -vy;
            var zy = vx;

            var y0 = model.y + (L-H)*zy;
            var x0 = model.x + (L-H)*vy;
            var x1 = K*(x0 + L * vx - ry * vy);  var y1 = K*(y0 + L * zx - ry * zy);
            var x2 = K*(x0 + L * vx  + H * vy);  var y2 = K*(y0 + L * zx  + H * zy);
            var x3 = K*(x0 + rx * vx + H * vy);  var y3 = K*(y0 + rx * zx + H * zy);
            var x4 = K*(x0 - L * vx  + H * vy);  var y4 = K*(y0 - L * zx  + H * zy);
            var x5 = K*(x0 - L * vx + ry * vy);  var y5 = K*(y0 - L * zx + ry * zy);
            var x6 = K*(x0 - L * vx  - H * vy);  var y6 = K*(y0 - L * zx  - H * zy);
            var x7 = K*(x0 - rx * vx - H * vy);  var y7 = K*(y0 - rx * zx - H * zy);
            var x8 = K*(x0 + L * vx  - H * vy);  var y8 = K*(y0 + L * zx  - H * zy);

            ctx.beginPath();
            ctx.fillStyle = (this.color instanceof Function)
                          ? this.color(model)
                          : this.color;
              
            ctx.moveTo(x1,y1);
            ctx.arcTo(x2,y2,x3,y3,K*R);
            ctx.arcTo(x4,y4,x5,y5,K*R);
            ctx.arcTo(x6,y6,x7,y7,K*R);
            ctx.arcTo(x8,y8,x1,y1,K*R);
            ctx.closePath();

            ctx.fill();
            ctx.stroke();
            this.draw_overlay(ctx, model, viewctx);

            ctx.fillStyle = 'black';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            var font_family = "'Segoe UI', 'Lucida Grande', Arial";
            var fsz;
            if (model.id < 1000) {
                fsz = 15;
            } else if (model.id < 10000) {
                fsz = 11;
            } else {
                fsz = 8.5;
            }
            ctx.font = fsz+"px "+font_family;
            ctx.save();
            ctx.translate(K*x0,K*y0);
            ctx.rotate(-Math.atan2(vy,vx));
            ctx.fillText(model.name, 0, 0);
            ctx.restore();
        },
        draw_overlay: function(ctx) {}
    }

    function WidgetPersonView(size, R, color, options) {
        // options.facecolor can be one of the following:
        // - a color
        // - null -- random, either using Math.random() or 

        this._init(size, R, color);
        if (options == null) {
            options = {}
        }
        const r = options.randomGenerator || function() { return Math.random();};
        if (options.randomGenerator) {
            var k = Math.floor(r()*12);
            var colors = ['#eeeeee','#f6e6e6','#e6f6e6','#e6e6f6'];
            var colors = ['#e0e0e0','#f8d8e8','#e8f8d8','#d8e8f8'];
            const i1 = k&3;
            const i2 = (k>>2) + ((k>>2)==i1 ? 1 : 0);
            this.color = colors[i1];
        }
        this.stripecolor = '#f4f4f4';
        if (options.facecolor == null) {
            const i = Math.floor(r()*5);
            const color = this.skinColors()[i];
            function rgbbyte(x) { return ('0'+(x&0xff).toString(16)).slice(-2);}
            facecolor = '#'+rgbbyte(color>>16)+rgbbyte(color>>8)+rgbbyte(color);
        }
        this.facecolor = facecolor;
    }
    WidgetPersonView.prototype = Object.create(WidgetView.prototype);
    WidgetPersonView.prototype.bodyHeight = function() { 
        return this.L * 0.7; 
    }
    WidgetPersonView.prototype.skinColors = function() {
        // https://mellab-inha.github.io/static/pdf/CorrelationBetweenLightAbsorba.pdf
        // fefefe and fbeed2 are the two lightest 
        // 0xfff579 ~ lego yellow
        return [0xfcf6e8, 0xeacd79, 0xd7a306, 0x96734e, 0x6e3b07];
    },
    WidgetPersonView.prototype.draw = function(ctx, model, viewctx) {
        WidgetView.prototype.draw.call(this, ctx, model, viewctx);

        var K = viewctx.scale;
        var L = this.L;
        var H = this.bodyHeight();

        var vx = this.vx;
        var vy = this.vy;
        var zx = -vy;
        var zy = vx;

        var r = (L-H)*1.4;
        var y0 = model.y - (L-r)*zy;
        var x0 = model.x - (L-r)*vy;

        ctx.beginPath();
        ctx.arc(K*x0, K*y0, K*r, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.facecolor;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = 'black';
        // eyes
        var ex = 0.4*r;
        var ey = -0.2*r;
        var er = 0.04;
        // nose
        var nx = 0;
        var ny = 0.33*r;
        var nr = 0.04;
        ctx.arc(K*(x0+ex*vx+ey*vy), K*(y0+ex*zx+ey*zy), K*er, 0, 2 * Math.PI, false);
        ctx.arc(K*(x0-ex*vx+ey*vy), K*(y0-ex*zx+ey*zy), K*er, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(K*(x0+nx*vx+ny*vy), K*(y0+nx*zx+ny*zy), K*nr, 0, 2 * Math.PI, false);
        ctx.fill();

    }
    WidgetPersonView.prototype.draw_overlay = function(ctx, model, viewctx) {
        var K = viewctx.scale;
        var L = this.L;
        var H = this.bodyHeight();

        var vx = this.vx;
        var vy = this.vy;
        var zx = -vy;
        var zy = vx;

        var h = (L-H);
        var y0 = model.y + h*zy;
        var x0 = model.x + h*vy;
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        var h = H*0.9;
        var w = L*0.2;
        ctx.moveTo(K*(x0-1*w*vx),K*(y0-h*zy));
        ctx.lineTo(K*(x0-3*w*vx),K*(y0-h*zy));
        ctx.lineTo(K*(x0-3*w*vx),K*(y0+h*zy));
        ctx.lineTo(K*(x0-1*w*vx),K*(y0+h*zy));
        ctx.closePath();
        ctx.moveTo(K*(x0+1*w*vx),K*(y0-h*zy));
        ctx.lineTo(K*(x0+3*w*vx),K*(y0-h*zy));
        ctx.lineTo(K*(x0+3*w*vx),K*(y0+h*zy));
        ctx.lineTo(K*(x0+1*w*vx),K*(y0+h*zy));
        ctx.closePath();
        /*
        ctx.moveTo(K*(x0-L*vx),K*(y0-3*h*zy));
        ctx.lineTo(K*(x0-L*vx),K*(y0-1*h*zy));
        ctx.lineTo(K*(x0+L*vx),K*(y0-1*h*zy));
        ctx.lineTo(K*(x0+L*vx),K*(y0-3*h*zy));
        ctx.closePath();
        ctx.moveTo(K*(x0-L*vx),K*(y0+3*h*zy));
        ctx.lineTo(K*(x0-L*vx),K*(y0+1*h*zy));
        ctx.lineTo(K*(x0+L*vx),K*(y0+1*h*zy));
        ctx.lineTo(K*(x0+L*vx),K*(y0+3*h*zy));
        ctx.closePath();*/
        ctx.fillStyle = this.stripecolor;
        ctx.fill();
        ctx.restore();
    }

    return {Model: WidgetModel,
            View: WidgetView,
            PersonView: WidgetPersonView
           };
})