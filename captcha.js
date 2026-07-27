/**
 * Captcha by JBS - Next-Gen Accessible, Touch & Anti-Bot Security Library
 * Author: JBS
 *
 * Feature Updates:
 * 1. Fixed Auto-Click & Custom Callback Execution Order:
 *    - Executes `onSuccess` callback immediately upon verification.
 *    - Triggers `targetButton.click()` if `auto: true` and no explicit `onSuccess` callback was provided.
 * 2. Pre-Validation Callback (`onBeforeStart`).
 * 3. Accessibility Modes (`accessibility: 'on' | 'off' | 'always'`).
 */

class JBSCaptcha {
    constructor(target, options = {}) {
        let rawTarget = null;
        if (typeof target === 'string') {
            rawTarget = document.querySelector(target);
        } else if (target && target.jquery) {
            rawTarget = target[0];
        } else if (target && target.nodeType === 1) {
            rawTarget = target;
        }

        if (!rawTarget) throw new Error(`Captcha by JBS: Target element '${target}' could not be found.`);

        // Default SVG Icons
        const defaultArrowIcon = `<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5v10z"/></svg>`;
        const defaultCheckIcon = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        const defaultA11yIcon = `<svg viewBox="0 0 24 24"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/></svg>`;

        // Check if target is a BUTTON or FORM SUBMIT element
        const isButton = rawTarget.tagName === 'BUTTON' || rawTarget.tagName === 'INPUT' || rawTarget.getAttribute('role') === 'button';

        if (isButton) {
            this.targetButton = rawTarget;
            this.container = document.createElement('div');
            this.container.className = 'jbs-captcha-auto-container';
            this.container.style.marginBottom = '16px';
            this.targetButton.parentNode.insertBefore(this.container, this.targetButton);
        } else {
            this.targetButton = null;
            this.container = rawTarget;
        }

        // Determine Preset Types & Semantic Color Palettes
        const presetType = options.type || 'custom';
        let defaultLabel = "Slide to continue";
        let defaultVerifiedText = "Successful";
        let defaultPendingText = "Processing...";
        let defaultPrimaryColor = null;
        let defaultGlowColor = null;

        switch (presetType) {
            case 'login':
            case 'signin':
                defaultLabel = "Swipe to Login";
                defaultVerifiedText = "Logging in...";
                defaultPendingText = "Logging in...";
                break;
            case 'register':
            case 'signup':
                defaultLabel = "Swipe to Register";
                defaultVerifiedText = "Registering...";
                defaultPendingText = "Registering...";
                break;
            case 'submit':
            case 'send':
                defaultLabel = "Swipe to Submit";
                defaultVerifiedText = "Submitting...";
                defaultPendingText = "Submitting...";
                defaultPrimaryColor = '#10b981';
                defaultGlowColor = 'rgba(16, 185, 129, 0.2)';
                break;
            case 'pay':
            case 'checkout':
                defaultLabel = "Swipe to Pay";
                defaultVerifiedText = "Processing Payment...";
                defaultPendingText = "Processing Payment...";
                defaultPrimaryColor = '#10b981';
                defaultGlowColor = 'rgba(16, 185, 129, 0.2)';
                break;
            case 'delete':
            case 'danger':
                defaultLabel = "Swipe to Confirm Delete";
                defaultVerifiedText = "Deleting...";
                defaultPendingText = "Deleting...";
                defaultPrimaryColor = '#ef4444';
                defaultGlowColor = 'rgba(239, 68, 68, 0.2)';
                break;
            case 'download':
                defaultLabel = "Swipe to Download";
                defaultVerifiedText = "Preparing Download...";
                defaultPendingText = "Preparing Download...";
                defaultPrimaryColor = '#10b981';
                defaultGlowColor = 'rgba(16, 185, 129, 0.2)';
                break;
        }

        const direction = options.direction || 'horizontal';
        const size = options.size || 'md';
        const shape = options.shape || 'circle';

        let a11yMode = options.accessibility || 'on';
        if (options.showAccessibility === false) a11yMode = 'off';

        // Clean & Intuitive Options
        this.config = Object.assign({
            type: presetType,
            direction: direction,
            size: size,
            shape: shape,
            tooltip: true,

            theme: 'auto',
            label: defaultLabel,
            verifiedText: defaultVerifiedText,
            pendingText: defaultPendingText,

            auto: true,
            animation: true,
            accessibility: a11yMode,
            rotateOnHoverLeave: false,
            botProtection: true,
            randomStart: true,

            icon: defaultArrowIcon,
            verifiedIcon: defaultCheckIcon,
            a11yIcon: defaultA11yIcon,

            accessibilityLabel: "Security verification slider. Use arrow keys or step buttons to align, then press Enter to execute.",
            audioSonar: true,

            tolerance: 16,
            colors: {},
            onBeforeStart: null,                  // Validation Callback function: () => boolean
            validationErrorText: "Please fill out required form fields first",
            onSuccess: null
        }, options);

        this.semanticPrimaryColor = defaultPrimaryColor;
        this.semanticGlowColor = defaultGlowColor;

        this.state = {
            isDragging: false,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0,
            currentX: 0,
            currentY: 0,
            targetX: 0,
            targetY: 0,
            maxSlideX: 0,
            maxSlideY: 0,
            solved: false,
            audioMuted: !this.config.audioSonar,
            a11yOpen: this.config.accessibility === 'always',
            pointerTrail: []
        };

        this.audioCtx = null;
        this._resolvePromise = null;
        this.promise = new Promise((resolve) => {
            this._resolvePromise = resolve;
        });

        this.init();
    }

    init() {
        this._injectStyles();
        this._buildDOM();
        this._applyTheme();
        this._attachEvents();
        this._setupButtonBehavior();
        this._initCanvas();
    }

    _setupButtonBehavior() {
        if (!this.targetButton) return;

        if (this.config.auto) {
            this.targetButton.style.display = 'none';
        } else {
            this.targetButton.style.display = '';
            this.targetButton.disabled = true;
            this.targetButton.style.cursor = 'not-allowed';
            this.targetButton.style.opacity = '0.65';
        }
    }

    _initializePositions() {
        if (this.state.solved || this.state.isDragging) return;
        if (!this.wrapper || !this.targetNode || !this.sliderNode) return;

        const wrapperWidth = this.wrapper.offsetWidth;
        const wrapperHeight = this.wrapper.offsetHeight;
        const sliderWidth = this.sliderNode.offsetWidth;
        const sliderHeight = this.sliderNode.offsetHeight;
        const targetWidth = this.targetNode.offsetWidth;
        const targetHeight = this.targetNode.offsetHeight;
        
        this.state.maxSlideX = wrapperWidth - sliderWidth - 8;
        this.state.maxSlideY = wrapperHeight - sliderHeight - 8;

        if (this.config.randomStart) {
            if (this.config.direction === 'horizontal') {
                const startLeftHalf = Math.random() > 0.5;
                this.state.initialX = startLeftHalf ? 
                    Math.floor(Math.random() * (this.state.maxSlideX * 0.3)) : 
                    Math.floor(this.state.maxSlideX * 0.7 + Math.random() * (this.state.maxSlideX * 0.3));
                this.state.initialY = 0;
            } else if (this.config.direction === 'vertical') {
                this.state.initialX = (wrapperWidth / 2) - (sliderWidth / 2);
                this.state.initialY = Math.floor(Math.random() * (this.state.maxSlideY * 0.3));
            } else {
                this.state.initialX = Math.floor(Math.random() * (this.state.maxSlideX * 0.3));
                this.state.initialY = Math.floor(Math.random() * (this.state.maxSlideY * 0.3));
            }
        } else {
            this.state.initialX = 0;
            this.state.initialY = 0;
        }

        this.state.currentX = this.state.initialX;
        this.state.currentY = this.state.initialY;
        this.sliderNode.style.transform = `translate(${this.state.currentX}px, ${this.state.currentY}px)`;

        if (this.config.direction === 'horizontal') {
            if (this.state.initialX < (this.state.maxSlideX / 2)) {
                const minX = Math.floor(wrapperWidth * 0.55);
                const maxX = wrapperWidth - targetWidth - 8;
                this.state.targetX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
            } else {
                const minX = 8;
                const maxX = Math.floor(wrapperWidth * 0.4);
                this.state.targetX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
            }
            // Align target area vertically in the exact center of container
            this.state.targetY = (wrapperHeight / 2) - (targetHeight / 2);
        } else if (this.config.direction === 'vertical') {
            const sliderLeft = (wrapperWidth / 2) - (sliderWidth / 2);
            const sliderCenterX = sliderLeft + (sliderWidth / 2);
            this.state.targetX = sliderCenterX - (targetWidth / 2);
            const minY = Math.floor(wrapperHeight * 0.5);
            const maxY = Math.max(minY, wrapperHeight - targetHeight - 6);
            this.state.targetY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
        } else {
            const minX = Math.floor(wrapperWidth * 0.5);
            const maxX = wrapperWidth - targetWidth - 8;
            const minY = Math.floor(wrapperHeight * 0.5);
            const maxY = wrapperHeight - targetHeight - 8;
            this.state.targetX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
            this.state.targetY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
        }

        this.targetNode.style.transform = `translate(${this.state.targetX}px, ${this.state.targetY}px)`;
    }

    _injectStyles() {
        if (document.getElementById('jbs-captcha-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'jbs-captcha-styles';
        style.innerHTML = `
            .jbs-captcha-wrapper {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-family: system-ui, -apple-system, sans-serif;
                -webkit-user-select: none;
                user-select: none;
            }

            .jbs-split-row {
                display: flex;
                width: 100%;
                gap: 6px;
            }

            .jbs-split-row.size-sm.is-horizontal { height: 42px; }
            .jbs-split-row.size-md.is-horizontal { height: 54px; }
            .jbs-split-row.size-lg.is-horizontal { height: 66px; }
            .jbs-split-row.size-xl.is-horizontal { height: 78px; }

            .jbs-split-row.size-sm.is-square { height: 170px; }
            .jbs-split-row.size-md.is-square { height: 220px; }
            .jbs-split-row.size-lg.is-square { height: 270px; }
            .jbs-split-row.size-xl.is-square { height: 320px; }

            .jbs-captcha {
                --bg: #ffffff;
                --border: #cbd5e1;
                --text: #475569;
                --primary: #0056b3;
                --primary-glow: rgba(0, 86, 179, 0.15);
                --slider-bg: #ffffff;
                --success: #059669;
                --success-glow: rgba(5, 150, 105, 0.15);
                --focus-ring: #2563eb;
                
                position: relative;
                flex: 1 1 100%;
                height: 100%;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                box-sizing: border-box;
                overflow: hidden;
                -webkit-user-select: none;
                user-select: none;
                -webkit-touch-callout: none;
                touch-action: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }

            .jbs-captcha.has-animation {
                transition: border-color 0.3s, box-shadow 0.3s;
            }

            .jbs-captcha.has-animation:hover {
                box-shadow: 0 0 15px var(--primary-glow);
            }

            .jbs-draw-canvas {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2;
            }

            .jbs-a11y-trigger {
                flex: 0 0 46px;
                height: 100%;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                color: var(--text);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
            }

            .jbs-a11y-trigger:hover {
                border-color: var(--primary);
                color: var(--primary);
            }

            .jbs-a11y-trigger:focus-visible {
                border-color: var(--focus-ring);
                box-shadow: 0 0 0 3px var(--primary-glow);
            }

            .jbs-a11y-trigger svg {
                width: 22px;
                height: 22px;
                fill: currentColor;
            }

            .jbs-captcha.jbs-dark,
            .jbs-split-row.jbs-dark .jbs-a11y-trigger {
                --bg: #0f172a;
                --border: #334155;
                --text: #94a3b8;
                --primary: #00f3ff;
                --primary-glow: rgba(0, 243, 255, 0.15);
                --slider-bg: #1e293b;
                --success: #10b981;
                --focus-ring: #00f3ff;
            }

            .jbs-text {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 1px;
                color: var(--text);
                text-transform: uppercase;
                z-index: 1;
                pointer-events: none;
                transition: opacity 0.3s;
                text-align: center;
            }

            .jbs-split-row.size-sm .jbs-text { font-size: 11px; }
            .jbs-split-row.size-lg .jbs-text { font-size: 15px; }
            .jbs-split-row.size-xl .jbs-text { font-size: 17px; }

            .jbs-target {
                position: absolute;
                top: 0; left: 0;
                width: 44px;
                height: 44px;
                background: var(--primary-glow);
                border: 2px dashed var(--primary);
                box-sizing: border-box;
                z-index: 3;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
            }

            .shape-circle .jbs-target,
            .shape-circle .jbs-slider {
                border-radius: 50%;
            }

            .shape-square .jbs-target,
            .shape-square .jbs-slider {
                border-radius: 8px;
            }

            .shape-triangle .jbs-target,
            .shape-triangle .jbs-slider {
                border-radius: 0;
                clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
            }

            .jbs-split-row.size-sm .jbs-target { width: 34px; height: 34px; }
            .jbs-split-row.size-md .jbs-target { width: 44px; height: 44px; }
            .jbs-split-row.size-lg .jbs-target { width: 54px; height: 54px; }
            .jbs-split-row.size-xl .jbs-target { width: 64px; height: 64px; }

            .jbs-captcha.has-animation .jbs-target {
                animation: jbsPulseGlow 2s infinite ease-in-out;
            }

            @keyframes jbsPulseGlow {
                0%, 100% { box-shadow: 0 0 5px var(--primary-glow); }
                50% { box-shadow: 0 0 16px var(--primary); }
            }

            .jbs-captcha:hover .jbs-target,
            .jbs-captcha.is-hovered .jbs-target,
            .jbs-captcha.is-active-sliding .jbs-target {
                opacity: 1;
            }

            .jbs-slider {
                position: absolute;
                top: 4px; left: 4px;
                width: 34px;
                height: 34px;
                background: var(--slider-bg);
                border: 1px solid var(--border);
                cursor: grab;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 4;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                color: var(--primary);
                font-size: 16px;
                will-change: transform;
                outline: none;
                -webkit-tap-highlight-color: transparent;
                transition: transform 0.1s linear, background-color 0.3s, opacity 0.3s, box-shadow 0.2s, scale 0.2s;
            }

            .jbs-split-row.size-sm .jbs-slider { width: 26px; height: 26px; font-size: 12px; }
            .jbs-split-row.size-md .jbs-slider { width: 34px; height: 34px; font-size: 15px; }
            .jbs-split-row.size-lg .jbs-slider { width: 42px; height: 42px; font-size: 18px; }
            .jbs-slider:hover {
                box-shadow: 0 0 12px var(--primary-glow);
                cursor: grab;
            }
            .jbs-slider.is-active-sliding {
                box-shadow: 0 0 14px var(--primary);
                cursor: grabbing !important;
                transition: none !important;
            }

            .jbs-slider:focus-visible {
                border: 2px solid var(--focus-ring);
                box-shadow: 0 0 0 4px var(--primary-glow);
            }

            .jbs-slider svg { width: 18px; height: 18px; fill: currentColor; }
            .jbs-split-row.size-sm .jbs-slider svg { width: 13px; height: 13px; }
            .jbs-split-row.size-md .jbs-slider svg { width: 17px; height: 17px; }
            .jbs-split-row.size-lg .jbs-slider svg { width: 21px; height: 21px; }
            .jbs-split-row.size-xl .jbs-slider svg { width: 25px; height: 25px; }

            .jbs-tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%) translateY(4px);
                background: #090d16;
                color: var(--primary);
                border: 1px solid var(--border);
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: all 0.2s ease-in-out;
                z-index: 10;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .jbs-tooltip.is-warning {
                background: #ef4444 !important;
                color: #ffffff !important;
                border-color: #dc2626 !important;
                opacity: 1 !important;
                transform: translateX(-50%) translateY(0) !important;
            }

            .jbs-captcha:hover .jbs-tooltip,
            .jbs-slider:focus .jbs-tooltip {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            .jbs-a11y-toolbar {
                display: none;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px dashed var(--border);
                border-radius: 6px;
                font-size: 11px;
                color: var(--text);
                animation: jbsFadeIn 0.2s ease-in-out;
            }

            .jbs-a11y-toolbar.is-active {
                display: flex;
            }

            @keyframes jbsFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .jbs-a11y-btn-group {
                display: flex;
                gap: 4px;
            }

            .jbs-a11y-btn {
                background: var(--slider-bg);
                border: 1px solid var(--border);
                color: var(--text);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
            }

            .jbs-a11y-btn:hover {
                border-color: var(--primary);
                color: var(--primary);
            }

            .jbs-a11y-btn:focus-visible {
                outline: 2px solid var(--focus-ring);
            }

            .jbs-a11y-label {
                font-size: 11px;
                opacity: 0.85;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .jbs-sr-only {
                position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
                overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
            }

            .jbs-captcha.is-verified {
                border-color: var(--success);
                background: var(--success-glow);
            }
            .jbs-captcha.is-verified .jbs-text { color: var(--success); }
        `;
        document.head.appendChild(style);
    }

    _buildDOM() {
        const isSquare = this.config.direction === 'vertical' || this.config.direction === 'diagonal' || this.config.direction === 'all';
        const rowLayoutClass = isSquare ? 'is-square' : 'is-horizontal';
        const sizeClass = `size-${this.config.size}`;
        const shapeClass = `shape-${this.config.shape}`;

        const tooltipHTML = this.config.tooltip ? `
            <div class="jbs-tooltip" role="tooltip">
                💡 Align handle with the target ${this.config.shape}
            </div>
        ` : '';

        const a11yButtonHTML = (this.config.accessibility === 'on') ? `
            <button type="button" class="jbs-a11y-trigger" aria-label="Toggle Assistive Controls" title="Accessibility Assistive Controls">
                ${this.config.a11yIcon}
            </button>
        ` : '';

        const isToolbarActive = (this.config.accessibility === 'always') ? 'is-active' : '';
        const a11yToolbarHTML = (this.config.accessibility !== 'off') ? `
            <div class="jbs-a11y-toolbar ${isToolbarActive}" role="region" aria-label="Accessibility Assistance Controls">
                <span class="jbs-a11y-label">
                    Assistive Tools
                </span>
                <div class="jbs-a11y-btn-group">
                    <button type="button" class="jbs-a11y-btn jbs-step-left" aria-label="Move slider left">
                        ◄ Step Left
                    </button>
                    <button type="button" class="jbs-a11y-btn jbs-step-right" aria-label="Move slider right">
                        Step Right ►
                    </button>
                    <button type="button" class="jbs-a11y-btn jbs-audio-toggle" aria-label="Toggle audio sonar feedback">
                        🔊 Sonar
                    </button>
                </div>
            </div>
        ` : '';

        const animClass = this.config.animation ? 'has-animation' : '';

        this.container.innerHTML = `
            <div class="jbs-captcha-wrapper">
                <div class="jbs-split-row ${rowLayoutClass} ${sizeClass} ${shapeClass}">
                    <div class="jbs-captcha ${animClass}">
                        ${tooltipHTML}
                        <canvas class="jbs-draw-canvas"></canvas>
                        <div class="jbs-text" aria-hidden="true">
                            <span class="jbs-text-content">${this.config.label}</span>
                        </div>
                        <div class="jbs-target" aria-hidden="true"></div>
                        <div class="jbs-slider" 
                             role="slider" 
                             tabindex="0" 
                             aria-label="${this.config.accessibilityLabel}"
                             aria-valuemin="0" 
                             aria-valuemax="100" 
                             aria-valuenow="0">
                            ${this.config.icon}
                        </div>
                        <div class="jbs-sr-only" aria-live="polite"></div>
                    </div>

                    ${a11yButtonHTML}
                </div>

                ${a11yToolbarHTML}
            </div>
        `;

        this.splitRow = this.container.querySelector('.jbs-split-row');
        this.wrapper = this.container.querySelector('.jbs-captcha');
        this.canvas = this.container.querySelector('.jbs-draw-canvas');
        this.textNode = this.container.querySelector('.jbs-text');
        this.textContentNode = this.container.querySelector('.jbs-text-content');
        this.targetNode = this.container.querySelector('.jbs-target');
        this.sliderNode = this.container.querySelector('.jbs-slider');
        this.tooltipNode = this.container.querySelector('.jbs-tooltip');
        this.announceNode = this.container.querySelector('.jbs-sr-only');
        
        this.a11yTriggerBtn = this.container.querySelector('.jbs-a11y-trigger');
        this.a11yToolbar = this.container.querySelector('.jbs-a11y-toolbar');
        this.btnLeft = this.container.querySelector('.jbs-step-left');
        this.btnRight = this.container.querySelector('.jbs-step-right');
        this.btnAudio = this.container.querySelector('.jbs-audio-toggle');

        requestAnimationFrame(() => {
            this._initializePositions();
        });
    }

    _initCanvas() {
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    _resizeCanvas() {
        if (!this.canvas || !this.wrapper) return;
        this.canvas.width = this.wrapper.offsetWidth;
        this.canvas.height = this.wrapper.offsetHeight;
    }

    _clearDrawingTrail() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    _renderDrawingTrail() {
        if (!this.config.animation || !this.ctx || this.state.pointerTrail.length < 2) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.beginPath();
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        const primaryColor = getComputedStyle(this.wrapper).getPropertyValue('--primary').trim() || '#00f3ff';
        this.ctx.strokeStyle = primaryColor;
        this.ctx.shadowColor = primaryColor;
        this.ctx.shadowBlur = 8;

        const rect = this.wrapper.getBoundingClientRect();
        const pts = this.state.pointerTrail;

        this.ctx.moveTo(pts[0].x - rect.left, pts[0].y - rect.top);
        for (let i = 1; i < pts.length; i++) {
            this.ctx.lineTo(pts[i].x - rect.left, pts[i].y - rect.top);
        }
        this.ctx.stroke();
    }

    _applyTheme() {
        let isDark = false;
        if (this.config.theme === 'dark') isDark = true;
        else if (this.config.theme === 'auto') {
            isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        if (isDark) {
            this.wrapper.classList.add('jbs-dark');
            this.splitRow.classList.add('jbs-dark');
        }

        if (this.semanticPrimaryColor) {
            this.wrapper.style.setProperty('--primary', this.semanticPrimaryColor);
            this.wrapper.style.setProperty('--focus-ring', this.semanticPrimaryColor);
        }
        if (this.semanticGlowColor) {
            this.wrapper.style.setProperty('--primary-glow', this.semanticGlowColor);
        }

        const customColors = this.config.colors;
        if (customColors) {
            const modeColors = isDark ? customColors.dark : customColors.light;
            const activeColors = modeColors || customColors;
            if (activeColors && typeof activeColors === 'object') {
                for (const [key, value] of Object.entries(activeColors)) {
                    this.wrapper.style.setProperty(`--${key}`, value);
                }
            }
        }
    }

    _attachEvents() {
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        this.sliderNode.addEventListener('pointerdown', this._onPointerDown);
        this.sliderNode.addEventListener('keydown', this._onKeyDown);

        this.sliderNode.addEventListener('touchstart', this._onTouchStart, { passive: false });
        window.addEventListener('touchmove', this._onTouchMove, { passive: false });
        window.addEventListener('touchend', this._onTouchEnd);
        window.addEventListener('touchcancel', this._onTouchEnd);
        
        this.wrapper.addEventListener('mouseenter', () => {
            this.wrapper.classList.add('is-hovered');
        });

        this.wrapper.addEventListener('mouseleave', () => {
            this.wrapper.classList.remove('is-hovered');
        });

        this.sliderNode.addEventListener('focus', () => this.wrapper.classList.add('is-hovered'));
        this.sliderNode.addEventListener('blur', () => this.wrapper.classList.remove('is-hovered'));

        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);

        if (this.a11yTriggerBtn) {
            this.a11yTriggerBtn.addEventListener('click', () => {
                this.state.a11yOpen = !this.state.a11yOpen;
                if (this.state.a11yOpen) {
                    this.a11yToolbar.classList.add('is-active');
                    this.announceNode.innerText = "Assistive tools panel expanded.";
                } else {
                    this.a11yToolbar.classList.remove('is-active');
                    this.announceNode.innerText = "Assistive tools panel collapsed.";
                }
            });
        }

        if (this.btnLeft) this.btnLeft.addEventListener('click', () => this._stepSlider(-10));
        if (this.btnRight) this.btnRight.addEventListener('click', () => this._stepSlider(10));
        if (this.btnAudio) {
            this.btnAudio.addEventListener('click', () => {
                this.state.audioMuted = !this.state.audioMuted;
                this.btnAudio.style.opacity = this.state.audioMuted ? '0.5' : '1';
                this.announceNode.innerText = this.state.audioMuted ? "Audio sonar disabled" : "Audio sonar enabled";
            });
        }
    }

    _checkValidationBeforeStart() {
        if (typeof this.config.onBeforeStart === 'function') {
            const isValid = this.config.onBeforeStart();
            if (!isValid) {
                if (this.tooltipNode) {
                    const originalText = this.tooltipNode.innerHTML;
                    this.tooltipNode.innerHTML = `⚠️ ${this.config.validationErrorText}`;
                    this.tooltipNode.classList.add('is-warning');
                    setTimeout(() => {
                        this.tooltipNode.classList.remove('is-warning');
                        this.tooltipNode.innerHTML = originalText;
                    }, 2500);
                }
                this.announceNode.innerText = this.config.validationErrorText;
                return false;
            }
        }
        return true;
    }

    _onTouchStart(e) {
        if (this.state.solved || !e.touches || !e.touches[0]) return;
        if (!this._checkValidationBeforeStart()) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._startDrag(touch.clientX, touch.clientY);
    }

    _onTouchMove(e) {
        if (!this.state.isDragging || this.state.solved || !e.touches || !e.touches[0]) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._moveDrag(touch.clientX, touch.clientY);
    }

    _onTouchEnd() {
        if (!this.state.isDragging || this.state.solved) return;
        this._endDrag();
    }

    _onPointerDown(e) {
        if (this.state.solved) return;
        if (!this._checkValidationBeforeStart()) return;
        this._startDrag(e.clientX, e.clientY);
    }

    _onPointerMove(e) {
        if (!this.state.isDragging || this.state.solved) return;
        this._moveDrag(e.clientX, e.clientY);
    }

    _onPointerUp() {
        if (!this.state.isDragging || this.state.solved) return;
        this._endDrag();
    }

    _startDrag(clientX, clientY) {
        this._initAudio();
        this.state.isDragging = true;
        
        const rect = this.wrapper.getBoundingClientRect();
        const sliderRect = this.sliderNode.getBoundingClientRect();

        // Calculate exact grab offset within thumb relative to wrapper
        this.state.dragOffsetX = clientX - sliderRect.left;
        this.state.dragOffsetY = clientY - sliderRect.top;
        
        this.state.pointerTrail = [{ x: clientX, y: clientY, t: Date.now() }];
        this.wrapper.classList.add('is-active-sliding');
        this.sliderNode.classList.add('is-active-sliding');
        document.body.style.cursor = 'grabbing';
        this.sliderNode.style.transition = 'none';
        this.textNode.style.opacity = '0.2';
    }

    _moveDrag(clientX, clientY) {
        const rect = this.wrapper.getBoundingClientRect();
        
        let moveX = clientX - rect.left - this.state.dragOffsetX - 4;
        let moveY = clientY - rect.top - this.state.dragOffsetY - 4;

        if (this.config.direction === 'horizontal') {
            moveY = (this.wrapper.offsetHeight / 2) - (this.sliderNode.offsetHeight / 2) - 4;
        } else if (this.config.direction === 'vertical') {
            moveX = 0;
        }

        if (moveX < 0) moveX = 0;
        if (moveX > this.state.maxSlideX) moveX = this.state.maxSlideX;

        if (moveY < 0) moveY = 0;
        if (moveY > this.state.maxSlideY) moveY = this.state.maxSlideY;
        
        this.state.currentX = moveX;
        this.state.currentY = moveY;
        this.sliderNode.style.transform = `translate(${moveX}px, ${moveY}px)`;

        this.state.pointerTrail.push({ x: clientX, y: clientY, t: Date.now() });
        this._renderDrawingTrail();
    }

    _endDrag() {
        this.state.isDragging = false;
        document.body.style.cursor = '';
        this.wrapper.classList.remove('is-active-sliding');
        this.sliderNode.classList.remove('is-active-sliding');
        this.sliderNode.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        this._validate();
    }

    _stepSlider(amount) {
        if (this.state.solved) return;
        if (!this._checkValidationBeforeStart()) return;
        this._initAudio();

        this.wrapper.classList.add('is-active-sliding');

        let newX = Math.max(0, Math.min(this.state.maxSlideX, this.state.currentX + amount));
        this.state.currentX = newX;
        this.sliderNode.style.transform = `translate(${newX}px, ${this.state.currentY}px)`;

        this._playAudioSonar(newX);

        const targetWidth = this.targetNode.offsetWidth;
        const sliderWidth = this.sliderNode.offsetWidth;
        const tol = this.config.tolerance;

        if (this.state.currentX >= (this.state.targetX - tol) && 
            this.state.currentX <= (this.state.targetX + targetWidth - sliderWidth + tol)) {
            this._triggerSuccess();
        }
    }

    _initAudio() {
        if (this.state.audioMuted || this.audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.audioCtx = new AudioContext();
        }
    }

    _playAudioSonar(currentPos) {
        if (this.state.audioMuted || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const distance = Math.abs(currentPos - this.state.targetX);
        const maxDist = this.state.maxSlideX || 1;
        
        const proximityRatio = 1 - Math.min(distance / maxDist, 1);
        const frequency = 200 + (proximityRatio * 680);

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.12);
    }

    _onKeyDown(e) {
        if (this.state.solved) return;
        if (!this._checkValidationBeforeStart()) return;
        this._initAudio();
        this.wrapper.classList.add('is-active-sliding');

        const step = 8;
        let newX = this.state.currentX;

        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            newX = Math.min(this.state.maxSlideX, this.state.currentX + step);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            newX = Math.max(0, this.state.currentX - step);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._validate();
            return;
        } else {
            return;
        }

        this.state.currentX = newX;
        this.sliderNode.style.transform = `translate(${newX}px, ${this.state.currentY}px)`;
        this._playAudioSonar(newX);

        const targetWidth = this.targetNode.offsetWidth;
        const sliderWidth = this.sliderNode.offsetWidth;
        const tol = this.config.tolerance;

        if (newX >= (this.state.targetX - tol) && newX <= (this.state.targetX + targetWidth - sliderWidth + tol)) {
            this._triggerSuccess();
        }
    }

    _verifyHumanPath() {
        if (!this.config.botProtection) return true;
        const trail = this.state.pointerTrail;
        if (trail.length < 5) return false;

        let speeds = [];
        let totalJitter = 0;

        for (let i = 1; i < trail.length; i++) {
            const dx = trail[i].x - trail[i - 1].x;
            const dy = trail[i].y - trail[i - 1].y;
            const dt = Math.max(1, trail[i].t - trail[i - 1].t);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            speeds.push(dist / dt);

            if (i > 1) {
                const prevDx = trail[i - 1].x - trail[i - 2].x;
                const prevDy = trail[i - 1].y - trail[i - 2].y;
                totalJitter += Math.abs(dx - prevDx) + Math.abs(dy - prevDy);
            }
        }

        const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - meanSpeed, 2), 0) / speeds.length;

        return (variance > 0 && (totalJitter > 0 || trail.length >= 6));
    }

    _validate() {
        const targetWidth = this.targetNode.offsetWidth;
        const sliderWidth = this.sliderNode.offsetWidth;
        const targetHeight = this.targetNode.offsetHeight;
        const sliderHeight = this.sliderNode.offsetHeight;
        const targetCenterX = this.state.targetX + (targetWidth / 2);
        const targetCenterY = this.state.targetY + (targetHeight / 2);

        const idealSliderX = targetCenterX - (sliderWidth / 2);
        const idealSliderY = targetCenterY - (sliderHeight / 2);

        const tol = this.config.tolerance;
        const alignedX = Math.abs(this.state.currentX - idealSliderX) <= (tol + (targetWidth - sliderWidth) / 2);
        const alignedY = Math.abs(this.state.currentY - idealSliderY) <= (tol + (targetHeight - sliderHeight) / 2);

        const isHuman = this._verifyHumanPath();

        if (alignedX && alignedY && isHuman) {
            // Snap slider to perfect center of target
            this.state.currentX = idealSliderX;
            this.state.currentY = idealSliderY;
            this.sliderNode.style.transform = `translate(${this.state.currentX}px, ${this.state.currentY}px)`;
            this._triggerSuccess();
        } else {
            this.state.currentX = this.state.initialX;
            this.state.currentY = this.state.initialY;
            this.sliderNode.style.transform = `translate(${this.state.currentX}px, ${this.state.currentY}px)`;
            this.textNode.style.opacity = '1';
            this._clearDrawingTrail();
            this.announceNode.innerText = isHuman ? "Alignment failed. Resetting position." : "Bot-like motion detected. Resetting.";
        }
    }

    _triggerSuccess() {
        this.state.solved = true;

        this._clearDrawingTrail();
        this.wrapper.classList.add('is-verified');

        this.textNode.innerHTML = `<span>${this.config.verifiedText}</span>`;
        this.textNode.style.opacity = '1';
        this.targetNode.style.opacity = '0';
        
        this.sliderNode.style.opacity = '0';
        this.sliderNode.style.pointerEvents = 'none';

        this.announceNode.innerText = `${this.config.verifiedText}. Verification successful.`;

        if (this.btnLeft) this.btnLeft.disabled = true;
        if (this.btnRight) this.btnRight.disabled = true;
        if (this.btnLeft) this.btnLeft.style.opacity = '0.5';
        if (this.btnRight) this.btnRight.style.opacity = '0.5';

        // 1. Execute explicit user-defined onSuccess callback if specified
        if (typeof this.config.onSuccess === 'function') {
            this.config.onSuccess(this);
        } else if (this.targetButton && this.config.auto) {
            // 2. Otherwise auto-click targetButton if auto: true
            setTimeout(() => {
                this.targetButton.disabled = false;
                this.targetButton.click();
            }, 250);
        }

        if (this.targetButton && !this.config.auto) {
            this.targetButton.disabled = false;
            this.targetButton.style.cursor = 'pointer';
            this.targetButton.style.opacity = '1';
        }

        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);

        if (this._resolvePromise) {
            this._resolvePromise(true);
        }
    }

    then(onFulfilled, onRejected) {
        return this.promise.then(onFulfilled, onRejected);
    }

    catch(onRejected) {
        return this.promise.catch(onRejected);
    }
}

/**
 * Global One-Liner Initializer - Captcha by JBS
 */
function captcha(target, options = {}) {
    return new JBSCaptcha(target, options);
}

window.JBSCaptcha = JBSCaptcha;
window.AegisCaptcha = JBSCaptcha;
window.captcha = captcha;