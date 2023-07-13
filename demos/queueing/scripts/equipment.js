/*
 * equipment.js
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