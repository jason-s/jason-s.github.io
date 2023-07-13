/*
 * uiutil.js
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