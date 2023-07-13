/*
 * sink.js
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
define([],function() {
    // Sink for disposing of items
    function Model(id, options)
    {
        this.id = id;
        this.run = (options && (options.run instanceof Function)) 
                 ? options.run
                 : function() {};
    }
    Model.prototype = {
        insert: function(model, view, t) {
            model.log('stop',this.id,t);
            this.run(model,t);
            return true;
        },
        insertRate: function() { return 0; },
        update: function(t,dt) {},
        setup: function(action, data, context) {},
        clear: function() {},
        toString: function() {
            return "sink["+this.id+"]";
        }
    }

    function View(options) {}
    View.prototype = {
        draw: function(ctx, model) {}
    }

    return {Model:Model,
            View:View};
})