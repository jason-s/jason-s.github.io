define([], function() {
    function append_to(array1,array2)
    {
        // append all elements of array 2 to array 1
        array1.push.apply(array1,array2);
    }
    function execute(f) { f(); }

    function Equipment() {
        this.equipment = [];
        this.manifest = {};
        this.t = 0.0;
        this.tick = 1.0/256;
        this.warmup_tick = 0.1;
    }
    Equipment.prototype = {
        add: function(id, model, view)
        {
            var record = {id: id, model: model, view: view};
            this.equipment.push(record);
            this.manifest[id] = record;
        },
        update: function(t, dt, mode)
        {
            var dtsim = (mode == null) ? this.tick : this.warmup_tick;
            
            while (t > this.t)
            {
                var deferred_events = [];
                var tsim = this.t;
                this.equipment.forEach(function(item) {
                    var events = item.model.update(tsim,dtsim);
                    if (events != null)
                    {
                        append_to(deferred_events, events);
                    }
                });
                deferred_events.forEach(execute);
                this.t += dtsim;
            }
        },
        draw: function(ctx, viewctx)
        {
            this.equipment.forEach(function(item) {
                item.view.draw(ctx, item.model, viewctx);
            });
        },
        click: function(evt, viewctx) {
            evt.preventDefault();
            this.equipment.forEach(function(item) {
                if (item.view.click &&
                    item.view.hit_test(evt.offsetX, evt.offsetY, item.model, viewctx))
                {
                    item.view.click(item.model);
                }
            });
        },
        clear: function()
        {
            this.t = 0;
            var disposal_count = 0;
            this.equipment.forEach(function(equip_item) { 
                try {
                    var cleared = equip_item.model.clear();
                    if (cleared)
                    {
                        cleared.forEach(function(item) {
                            console.log("disposing of ", item.model.toString());
                            ++disposal_count;
                        });
                    } 
                } catch (error)
                {
                    console.error("wtf?", equip_item);
                }
            });
            console.log("Disposed of %d items.", disposal_count);
        }

    }

    function BaseModel() {}
    function subclass(T, Tbase, methods) {
        T.prototype = new Tbase();
        for (var name in methods) {
            T.prototype[name] = methods[name];
        }
    }
    function defineModel(T, methods) {
        subclass(T, BaseModel, methods);
    }

    return {BaseModel: BaseModel,
            defineModel: defineModel,
            Equipment: Equipment};
})