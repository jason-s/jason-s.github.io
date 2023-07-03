define([], function() {
    /* Processes */
    function ConstantTime(T) {
        this.T = T;
        this.tstart = null;
    }
    ConstantTime.prototype = {
        start: function(t) {
            this.tstart = t;
        },
        update: function(t,dt) {
            var tprev = this.t;
            this.t = t;
            if (this.tstart == null)
                return false;
            // has the status changed? (!done -> done or vice-versa)
            return (t     - this.tstart >= this.T)
                != (tprev - this.tstart >= this.T);
        },
        elapsed: function () {
            if (this.tstart == null)
                return 0;
            else 
                return this.t - this.tstart;
        },
        done: function() {
            return (this.tstart != null) && (this.t - this.tstart >= this.T);
        },
        stop: function() {
            this.tstart = null;
        },
        started: function() { return this.tstart != null; },
        progress: function() {
            if (this.tstart == null)
                return 0;
            else
                return Math.min(1, (this.t - this.tstart)/this.T);
        },
        get_state: function() { 
            if (this.tstart == null)
                return "READY";
            else if (this.t - this.tstart >= this.T)
                return "DONE";
            else
                return "RUN";
        },
        toString: function() { return "[ConstantTime T="+this.T+"]"; }
    }

    function poisson_delay(r) {
        return -Math.log(1-r.nextfloat());
    }
    function ConstantDelayGenerator(T) {
        this.T = T;
    }
    ConstantDelayGenerator.prototype = {
        next: function() {
            return this.T;
        }
    }
    function PoissonDelayGenerator(r,T) {
        // Poisson delay generator
        this.r = r;
        this.T = T;
    }
    PoissonDelayGenerator.prototype = {
        next: function() {
            return this.T*poisson_delay(this.r);
        }
    }
    function VariableDelayGenerator(r,T) {
        this.r = r;
        this.T = T;
        this.u = 0;
        this.random = false;
        this.listeners = [];
    }
    VariableDelayGenerator.prototype = {
        get_delay: function() {
            return (this.random) ? this.T*this.u
                                 : this.T;
        },
        next: function() {
            this.u = poisson_delay(this.r);
            return this.get_delay();
        },
        set_time: function(T) { this.T = T; },
        get_time: function() { return this.T; },
        set_type: function(type) {
            switch (type) {
                case 'poisson':
                    this.random = true;
                    break;
                case 'constant':
                    this.random = false;
                    break;
            }
        },
        subscribe: function(f) {
            this.listeners.push(f);
        },
        notify: function() {
            const me = this;
            this.listeners.forEach(function(f) { f(me.get_delay()); });
        }
    }
    function Poisson(r,T) {
        // Poisson process with mean interarrival time T
        // Implemented with memory so that the behavior is independent
        // of the simulation rate
        //
        // See https://en.wikipedia.org/wiki/Exponential_distribution#Random_variate_generation
        this.r = r;
        this.T = T;
        this.tstart = null;
    }
    Poisson.prototype = {
        start: function(t) {
            this.tstart = t;
            this.tend = t + this.T*poisson_delay(this.r);
            // we use 1-U rather than U to avoid log(0)
            // t - ... is correct: logarithm is always nonpositive
        },
        update: function(t,dt) {
            var tprev = this.t;
            this.t = t;
            if (this.tstart == null)
                return false;
            // has the status changed? (!done -> done or vice-versa)
            return (t     >= this.tend)
                != (tprev >= this.tend);
        },
        elapsed: function () {
            if (this.tstart == null)
                return 0;
            else 
                return this.t - this.tstart;
        },
        done: function() {
            return (this.tstart != null) && (this.t >= this.tend);
        },
        stop: function() {
            this.tstart = null;
        },
        started: function() { return this.tstart != null; },
        progress: function() { return null;
            // in a real memoryless Poisson process, 
            // we wouldn't know the progress
        },
        get_state: function() { 
            if (this.tstart == null)
                return "READY";
            else if (this.t >= this.tend)
                return "DONE";
            else
                return "RUN";
        },
        toString: function() { return "[Poisson T="+this.T+"]"; }
    }

    function OptimistsFolly(r,T,p,N,k) {
        this.r = r;
        this.T = T;
        this.p = p;
        this.N = N || 100;
        this.k = k || 1;
        this.T1 = this.k*T*Math.sqrt(12/this.N/p/(4-3*p));
        this.T0 = T/this.N - p*this.T1/2;

        this.tstart = null;
        this.state = 0;
        this.progressCount = 0;
        this.delayCount = 0;
    }
    OptimistsFolly.prototype = {
        start: function(t) {
            this.tstart = t;
            this.tnext = t;
            this.delayCount = 0;
            this.progressCount = 0;
            this.determineNextState();
        },
        determineNextState: function() {
            var x = this.r.nextfloat();
            if (x < this.p)
            {
                // infrequent delay, randomly distributed between 0 and T1
                ++this.delayCount;
                this.state = 2;
                this.tnext += this.r.nextfloat() * this.T1;
            }
            else
            {
                this.state = 1;
                this.tnext += this.T0;
            }
        },
        update: function(t,dt) {
            this.t = t;
            var oldState = this.state;
            if (this.state == 1 || this.state == 2)
            {
                while (t > this.tnext)
                {
                    if (this.state == 1)
                        ++this.progressCount;
                    if (this.progressCount < this.N)
                        this.determineNextState(); 
                    else {
                        this.state = 3; // done!
                        break;
                    }
                }
            }
            return this.state != oldState;
        },
        elapsed: function () {
            if (this.state == 0)
                return 0;
            else 
                return this.t - this.tstart;
        },
        done: function() {
            return this.state == 3;
        },
        stop: function() {
            this.state = 0;
        },
        started: function() { return this.state != 0; },
        progress: function() {
            if (this.state == 0)
                return 0;
            else
                return this.progressCount / this.N;
        },
        get_state: function() {
            switch (this.state) {
                case 0:
                    return "READY";
                case 1:
                    return "RUN";
                case 2:
                    return "DOWN";
                case 3:
                    return "DONE";
            }
        },
        toString: function() {
            return "[Optimist's Folly:"
               + " p="+this.p
               +", k="+this.k
               +", T="+this.T
               +", N="+this.N
               +", T0="+(this.T0/this.T).toFixed(6)+"T"
               +", T1="+(this.T1/this.T).toFixed(4)+"T"
               +"]";
        }
    }

    // https://burtleburtle.net/bob/rand/smallprng.html
    // https://www.pcg-random.org/posts/bob-jenkins-small-prng-passes-practrand.html
    function JSF32Random(seed)
    {
        this.seed(seed);
    }
    JSF32Random.prototype = {
        seed: function(seed) {
            this.a = 0xf1ea5eed;
            this.b = seed;
            this.c = seed;
            this.d = seed; 
            for (var i = 0; i < 20; ++i) {
                this.next();              
            }  
        },
        next: function() {
            e = 0xffffffff & (this.a - (((this.b << 27) | (this.b >>> 5))&0xffffffff));
            this.a = 0xffffffff & (this.b ^ (((this.c << 17) | (this.c >>> 15))&0xffffffff));
            this.b = 0xffffffff & (this.c + this.d);
            this.c = 0xffffffff & (this.d + e);
            this.d = 0xffffffff & (e + this.a);
            return this.d & 0xffffffff;
        },
        nextfloat: function() {
            /* based on V8's ToDouble: https://source.chromium.org/chromium/chromium/src/+/main:v8/src/base/utils/random-number-generator.h
                    static inline double ToDouble(uint64_t state0) {
                      // Exponent for double values for [1.0 .. 2.0)
                      static const uint64_t kExponentBits = uint64_t{0x3FF0000000000000};
                      uint64_t random = (state0 >> 12) | kExponentBits;
                      return base::bit_cast<double>(random) - 1;
                    }
             */
            const i1 = this.next();
            const i2 = this.next();
            const buffer = new ArrayBuffer(8);
            const view = new DataView(buffer);
            view.setUint32(0,(i2 >>> 12) | ((i1 << 20) & 0xffffffff), true);
            view.setUint32(4,(i1 >>> 12) | 0x3ff00000, true);
            return view.getFloat64(0,true) - 1;
        }
    }
    JSF32Random.Factory = function(seed) {
        this.seed = seed;
        this.generatorClass = JSF32Random;
        this.seedGenerator = new this.generatorClass(seed);
        this.generators = [];
    }
    JSF32Random.Factory.prototype = {
        next: function() {
            const seed = this.seedGenerator.next();
            const g = new this.generatorClass(seed);
            this.generators.push({generator: g, seed: seed});
            return g;
        },
        reset: function() {
            this.generators.forEach(function(info) {
                info.generator.seed(info.seed);
            })
        }
    }

    const Executor = (function() {
        // Executor
        function Model(id, options)
        {
            this.id = id;
            function nop() {}
            function ornop(f) { return (f instanceof Function) ? f : nop;}
            this.onClear = ornop(options.onClear);
            this.onUpdate = ornop(options.onUpdate);
        }
        Model.prototype = {
            update: function(t,dt) { this.onUpdate(); },
            setup: function(action, data, context) {},
            clear: function() { this.onClear(); },
            toString: function() {
                return "executor["+this.id+"]";
            }
        }
        function View(options) {}
        View.prototype = {
            draw: function(ctx, model) {}
        }
        return {Model: Model, View: View};
    })();

    /* test
    j = new JSF32Random(123);
    console.log(j.nextfloat());
    console.log(j.nextfloat());
    console.log(j.nextfloat());
    console.log(j.nextfloat());
    */ 
    /* test 
    j = new JSF32Random(123);
    console.log('%d',j.next());
    console.log('%d',j.next());
    console.log('%d',j.next());
    console.log('%d',j.next());
    */
    function CONWIP(max) {
        this.max = max;
        this.level = 0;
    } 
    CONWIP.prototype = {
        acquire: function() {
            const newlevel = this.level + 1;
            const success = newlevel <= this.max;
            if (success)
            {
                this.level = newlevel;
            }
            return success;
        },
        release: function() {
            const success = this.level >= 1;
            if (success)
            {
                --this.level;
            }
            return success;
        },
        reset: function() { this.level = 0; }
    }
    return {ConstantTime: ConstantTime,
            Poisson: Poisson,
            OptimistsFolly: OptimistsFolly, 
            JSF32Random: JSF32Random,
            Executor: Executor,
            
            ConstantDelayGenerator: ConstantDelayGenerator,
            PoissonDelayGenerator: PoissonDelayGenerator,
            VariableDelayGenerator: VariableDelayGenerator,

            CONWIP: CONWIP
        };
})