/*
 * main.js
 *
 * Copyright 2023 Jason M. Sachs
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
define(['conveyor','simulator'],
function(conveyor, simulator) {
    function parse_spec(spec, defaultspec)
    {
        if (spec == null)
            spec = defaultspec;
        if (spec == null)
            return null;
        var i = spec.indexOf(':');
        if (i < 0)
            return {type: spec, title:''};
        else
            return {type: spec.slice(0,i),
                    title: spec.slice(i+1)};
    }
    function params_with_prefix(params, prefix) {
        const result = {};
        const nprefix = prefix.length;
        params.forEach(function(value, key) {
            if (key.startsWith(prefix))
                result[key.slice(nprefix)] = value;
        });
        return result;
    }
    function set_defaults(obj, defaults) {
        for (var k in defaults)
            if (!(k in obj))
                obj[k] = defaults[k];
        return obj;
    }
    function is_empty(obj) {
        for (var k in obj)
        {
            return false;
        }
        return true;
    }
    function E27(min, max) {
        var base = [1,1.1,1.2,1.3,1.4,1.5,1.7,1.8,
                    2.0,2.2,2.4,2.6,2.8,3,3.3,3.6,
                    4.0,4.3,4.6,5.0,5.5,
                    6,6.5,7.1,7.7,8.4,9.2];
        var i0 = Math.floor(Math.log10(min));
        var i1 = Math.ceil(Math.log10(max));
        var result = [];
        for (var i = i0; i < i1; ++i)
        {
            var P10 = Math.pow(10,i);
            for (var j = 0; j < base.length; ++j)
            {
                var x = base[j]*P10;
                if (i > 0)
                    x = Math.round(x);
                if (x < min*0.999999999)
                    continue;
                if (x > max*1.000000001)
                    break;
                result.push(x);
            }
        }
        return result;
    }
    function setup_logslider(element, indicator, scale_spacing, onInputChange) {
        var min = element.min;
        var max = element.max;
        var scale = scale_spacing(min,max);
        var N = scale.length;
        var init_value = +(element.value);
        element.min = 0;
        element.max = N-1;
        element.step = 1;
        var index = N;
        for (var i = 0; i < N; ++i)
            if (scale[i] >= init_value) {
                index = i;
                break;
            }
        element.value = index;
        function change_speed(event) {
            var index = event.target.value;
            var speed = scale[index];
            indicator.value = speed;
            onInputChange(speed);
        }
        element.addEventListener('input', change_speed);
    }
    function nulldefault(x, xdefault) {
        return (x == null) ? xdefault : x;
    }
    function toNumber(s,defaultvalue) {
        if (typeof s === 'number')
          return s;
        if ((s != null) && (s.match(/[1-9]\d*/)))
          return +s;
        else
          return defaultvalue;
      }
    function setup(options) {
        var container = document.getElementById('sim-container');
        var canvas = document.createElement('canvas');
        canvas.width = options.width || 640;
        canvas.height = options.height || 480;
        var slider = document.getElementById('sim-speed');
        options.simulation.time_scale = +(slider.value);
        options.simulation.view = {
            xofs: nulldefault(options.xofs, 10),
            yofs: nulldefault(options.yofs, 10),
            scale: options.scale || 31
        };
        var sim = new simulator.Controller(canvas, options.simulation);

        document.getElementById('sim-restart').addEventListener('click',
            function(evt) { sim.restart(); });
        document.getElementById('sim-pause').addEventListener('change',
            function(evt) { sim.pause(evt.target.checked); });
        const autopause = document.getElementById('sim-autopause');
        if (autopause)
        {
            autopause.addEventListener('change', function(evt) {
                const timeregex = /^(\d+):(\d\d):(\d\d)$/;
                const timetext = evt.target.value;
                const m = timetext.match(timeregex);
                if (m) {
                    const time = m[1]*3600 + m[2]*60 + m[3]*1;
                    sim.autopause(time, function() {
                        document.getElementById('sim-pause').checked = true;
                    });
                }
                else {
                    sim.autopause(null);
                }
            })
        }
        var indicator = document.getElementById('sim-speed-indicator');
        setup_logslider(slider, indicator, 
                        options.simulation.time_scale_spacing,
                        function(value) {sim.set_scale(value)});
        var spacer = document.createElement('div');
        spacer.innerHTML = '&nbsp;';
        container.appendChild(spacer);
        var animate_options = {};
        if (options.show_time==null || options.show_time) {
            var elapsed = document.createElement('div');
            elapsed.classList.add('elapsed_time');
            container.appendChild(elapsed);
    
            animate_options.elapsed_time = elapsed;
        }
        container.appendChild(canvas);
        sim.view.annotate(container, options.annotations);
        sim.animate({elapsed_time: elapsed});

        var here = (function() {
            var here = window.location.pathname;
            var i = here.lastIndexOf('/');
            if (i >= 0)
                here = here.slice(i+1);
            if (window.location.search)
                here += window.location.search;
            return here;
        })();

        // see https://stackoverflow.com/a/45618188/44330 for the basic concept
        var observer = new IntersectionObserver(function(entries, opts) {
            entries.forEach(function(entry) {
                if (entry.target == container)
                {
                    const visible = entry.isIntersecting;
                    console.log((visible?"Entering":"Exiting")+" view: "+here);
                    sim.set_visible(entry.isIntersecting);
                }
            });
        }, {root: null, threshold: 0.05});
        observer.observe(container);

    }
    function LogContext(options) {
        options = options || {};
        this.notify_objects = options.notify_objects || false;
        this.time_quantum = options.time_quantum || 0;
        this.equip_id_filter = options.equip_id_filter || function(id) { return false; };
        this.reset();
    }
    LogContext.prototype = {
        reset: function() {
            this.events = [];
            this.time_ref = {q: 3600, t_next: 0};
            this.log_time_ref();
        },
        log: function(op, t, equip, obj) {
            if (this.notify_objects || this.equip_id_filter(equip.id))
                obj.log(op, equip.id, t);
            if (t >= this.time_ref.t_next) {
                this.log_time_ref();
            }
            const logt = this.time_quantum
                         ? Math.floor((t-this.time_ref.t)/this.time_quantum)
                         : t;
            this.events.push([op,logt,equip.id,obj.id]);
        },
        log_time_ref: function() {
            const tref = this.time_ref.t_next;
            this.events.push(['time_ref',tref]);
            this.time_ref.t = tref;
            this.time_ref.t_next = tref + this.time_ref.q;
        },
    }

    function SequenceLog(id)
    {
        this.id = id;
        this._log = {};
    }
    SequenceLog.prototype = {
        log: function(type, t) {
            const typelog = this._log[type] || [];
            if (typelog.push(t) == 1) {
                this._log[type] = typelog;
            }
        },
        report: function() {
            return {id:this.id,log:this._log};
        },
        reset: function() {
            this._log = {};
        }
    }

    return {
        setup: setup,
        parse_spec: parse_spec,
        params_with_prefix: params_with_prefix,
        set_defaults: set_defaults,
        is_empty: is_empty,
        toNumber: toNumber,
        E27: E27,
        query: function(selector) { return [].slice.call(document.querySelectorAll(selector)); },
        LogContext: LogContext,
        SequenceLog: SequenceLog
    }
})