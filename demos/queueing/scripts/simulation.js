define(["conveyor","widget","machine","equipment","sink","process"],
  function(conveyor, widget, machine, equipment,sink,process){
    function View(canvas, options) {
        this.canvas = canvas;
        this.updateCount = 0;
        this.viewOptions = options.view;
        var constructors = {
            conveyor: conveyor,
            machine:  machine,
            sink:     sink,
            executor: process.Executor
        }

        this.equipment = options.equipment.map(function(group) {
            const eq = new equipment.Equipment();

        // Instantiate model and view of each piece of equipment
            group.forEach(function(spec) {
                var EquipmentClass = constructors[spec.type];
                if (EquipmentClass == null)
                    console.error("Undefined equipment class "+spec.type);
                var model = new EquipmentClass.Model(spec.id, spec.model);
                var view  = new EquipmentClass.View(spec.view);
                eq.add(spec.id, model, view)
            });

        // Now set up each piece of equipment
        // (notably connections to others)
            group.forEach(function(spec){
                var childspec = spec.widget || {}
                var child = {
                    Model: widget.Model,
                    View: widget.View,
                    color: childspec.color || '#eee',
                    options: childspec.options
                };
                switch (childspec.class) {
                    case 'WidgetPerson':
                        child.View = widget.PersonView;
                }
                var model = eq.manifest[spec.id].model;
                if (!spec.setup)
                    return;
                spec.setup.forEach(function(step){
                    var action = step[0];
                    var data = step[1];
                    switch (action) {
                        case 'target':
                            var subject = data;
                            if (typeof subject === 'string') {
                                var target_record = eq.manifest[subject];
                                if (!target_record)
                                    throw new ReferenceError(spec.id+":setup: Unknown equipment '"+subject+"'");
                                model.target = target_record.model;
                            }
                            else if (subject instanceof Function) {
                                const lookup = function(name) {
                                    return eq.manifest[name].model;
                                }
                                model.target = function(widget) {
                                    return lookup(subject(widget));
                                }
                            }
                            else {
                                throw new TypeError(spec.id+":setup: Unknown target "+subject);
                            }
                            break;
                        default:
                            var context = {
                                create: function(t, n) {
                                    return {
                                        model: new child.Model(n,n),
                                        view:  new child.View(1,0.25,child.color,child.options)
                                    }
                                }
                            }
                            model.setup(action, data, context);
                    }
                });
            });
            return eq;
        });

        const me = this;
        canvas.addEventListener('click',function(evt){
            me.click(evt);
        });
    }
    View.prototype = {
        annotate: function(container, annotations) {
            if (!annotations)
                return;
            const options = this.viewOptions;
            annotations.forEach(function(annotation){
                var S = options.scale;
                var X0 = 10+S;
                var element = document.createElement('div');
                element.classList.add('annotation');
                if (annotation.halign == 'center')
                {
                    element.classList.add('align-center');
                }
                element.textContent = annotation.text;
                element.style.left = (annotation.x*S+X0) + "px";
                element.style.top  = (annotation.y*S+X0) + "px";
                if (annotation.fontSize)
                    element.style.fontSize = annotation.fontSize+"px";
                container.appendChild(element);
            });
        },
        update: function(t, dt, mode) {
            this.updateCount++;
            this.equipment.forEach(function(eq) { eq.update(t,dt,mode); });
        },
        draw: function()
        {
            var C = this.canvas;
            var ctx = C.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, C.width, C.height);
            var viewctx = {scale: this.viewOptions.scale};
            ctx.translate(this.viewOptions.xofs+viewctx.scale,
                          this.viewOptions.yofs+viewctx.scale);
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 1;
            // console.log(this.canvas.width, this.canvas.height);
            this.equipment.forEach(function(eq) {
                ['base','widget','machine'].forEach(function(layer) {
                    viewctx.layer = layer;
                    eq.draw(ctx, viewctx);
                });
            });
            ctx.restore();
        },
        click: function(evt) {
            const scale = this.viewOptions.scale
            var viewctx = {scale: scale,
                           xofs: this.viewOptions.xofs+scale,
                           yofs: this.viewOptions.yofs+scale};
            this.equipment.forEach(function(eq) {
                eq.click(evt, viewctx);
            });
        },
        restart: function()  { this.equipment.forEach(function(eq) {eq.clear(); }); }

    }
    return { View: View }; 
})