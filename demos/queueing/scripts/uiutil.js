define([], function() {
    /* UI utilities */
    function ScaledRangeSlider(id) {
        this.id = id;
        this.element = document.getElementById(id);
        this.indicator = document.getElementById(id+'-indicator');
        const K = this.element.step;
        const v = this.element.value;
        this.K = K;

        this.element.min = this.element.min/K;
        this.element.max = this.element.max/K;
        this.element.step = 1;
        this.element.value = v/K;
    }
    ScaledRangeSlider.prototype = {
        addChangeListener: function(f) {
            const me = this;
            this.element.addEventListener('input',function(event) {
                const v = me.K*event.target.value;
                f(event.target, v);
            });
            f(this.element, this.K*this.element.value);
        },
        indicate: function(x) {
            if (this.indicator) {
                this.indicator.value = x;
            }
        },
        setValue: function(x) {
            this.element.value = x/this.K;
            this.indicate(x);
        }
    }
    return {ScaledRangeSlider: ScaledRangeSlider};
});