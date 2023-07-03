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