define(['simulation'],function(simulation){
    function Controller(canvas, options)
    {
        this.view = new simulation.View(canvas, options);
        this.t = null;
        this.tsim = 0;
        this.running = true;
        this.visible = false;
        this.time_scale = options.time_scale || 1.0;
        this.warmup_time = Math.min(60000, Math.max(0, options.warmup_time || 0));
    }
    Controller.prototype = {
        animate: function(info) {
            var me = this;
            function format_time(t) {
                t = Math.floor(t);
                var min = Math.floor(t / 60);
                t -= min*60;
                var hour = Math.floor(min / 60);
                min -= hour*60;
                return hour+":"
                     +("0"+min).slice(-2)+":"
                     +("0"+t.toFixed(0)).slice(-2);
            }
            function note_time(t) {
                if (info.elapsed_time)
                {
                    info.elapsed_time.textContent = format_time(t);
                }
            }
            function step(timestamp) {
                var t = timestamp*1e-3;
                var dt = 0;
                var draw = false;
                if (me.t == null)
                {
                    draw = true;
                }
                else
                {
                    draw = true;
                    dt = Math.min(0.1, Math.max(0, t-me.t));
                }
                if (draw && me.running && me.visible)
                { 
                    var dtsim = dt * me.time_scale;
                    const tsim = me.tsim;
                    const tsimnext = tsim + dtsim;
                    if (me.autopause_time != null &&
                        tsim < me.autopause_time &&
                        tsimnext >= me.autopause_time)
                    {
                        dtsim = me.autopause_time - tsim;
                        me.running = false;
                        if (me.on_autopause)
                            me.on_autopause();
                    }
                    me.tsim += dtsim;
                    me.view.update(me.tsim, dtsim);
                    me.view.draw();
                    note_time(me.tsim);

                }
                me.t = t;
                window.requestAnimationFrame(step);
            };
            if (me.warmup_time > 0)
            {
                me.tsim = me.warmup_time;
                me.view.update(me.tsim, me.tsim, "warmup");
            }
            window.requestAnimationFrame(step);
        },
        restart: function() {
            this.tsim = 0;
            this.view.restart();
        },
        pause: function(p)   { this.running = !p; },
        autopause: function(t, on_autopause) {
            this.autopause_time = t;
            this.on_autopause = on_autopause;
        },
        set_visible: function(v) { this.visible = v},
        set_scale: function(scale) {
            this.time_scale = scale;
        }

    }

    return {
        Controller:Controller
    };
})