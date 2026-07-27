# Captcha by JBS 🛡️⚡

A lightweight, highly customizable, accessible, touch-friendly, and interactive client-side CAPTCHA library written in vanilla JavaScript with zero dependencies.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg) ![License](https://img.shields.io/badge/License-MIT-blue.svg) ![Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg) ![Accessibility](https://img.shields.io/badge/Accessibility-WCAG--Compliant-purple.svg)

---

## 🌟 Highlights & Features

- 🎨 **Preset Action Types**: Specialized presets for `login`, `register`, `submit`, `pay`, `delete`, and `download` with semantic color palettes and labels.
- 📱 **Responsive & Mobile/Touch Ready**: Built-in support for mouse drag, touch swipes, and dynamic layout auto-resizing.
- ♿ **WCAG Compliant Accessibility Options**: Accessible keyboard navigation, audio sonar feedback (Web Audio API), and screen reader ARIA support.
- 🤖 **Anti-Bot Velocity & Trail Analytics**: Built-in trajectory analysis, drag timing verification, and velocity checks to mitigate automated script attacks.
- 🧩 **Flexible Directions & Shapes**: Supports `horizontal`, `vertical`, and `2d` drag directions with `circle` or `square` sliders.
- ⚡ **Zero External Dependencies**: Standalone library with built-in CSS and SVG assets—simply import `captcha.js` or `captcha.min.js`.
- 🔌 **Seamless Form & Auto-Click Integration**: Automatic button masking, promise-based resolution (`await captcha.promise`), and custom callbacks.

---

## 🚀 Quick Start

### 1. Include the Library

Include `captcha.min.js` (or `captcha.js`) directly in your HTML `<head>` or before the closing `</body>` tag:

```html
<script src="path/to/captcha.min.js"></script>
```

### 2. Attach to a Form Button or Container

#### Option A: Target a Form Submit/Action Button (Recommended)

When you target a `<button>` or `<input type="submit">`, Captcha by JBS automatically replaces/masks the button with the interactive slider component and clicks or enables the button upon successful verification.

```html
<form id="loginForm">
    <input type="email" placeholder="Email" required />
    <input type="password" placeholder="Password" required />
    
    <!-- Captcha replaces this button automatically -->
    <button type="submit" id="submitBtn">Login</button>
</form>

<script>
    const captcha = new JBSCaptcha('#submitBtn', {
        type: 'login',
        onBeforeStart: () => {
            // Optional form validation before allowing slider drag
            return document.querySelector('#loginForm').checkValidity();
        },
        onSuccess: () => {
            console.log('User verified!');
        }
    });
</script>
```

#### Option B: Target a Container `<div>`

You can also render the CAPTCHA inside any target container element:

```html
<div id="captcha-container"></div>

<script>
    const captcha = new JBSCaptcha('#captcha-container', {
        type: 'submit',
        direction: 'horizontal',
        onSuccess: () => {
            console.log('Captcha solved!');
        }
    });
</script>
```

---

## ⚙️ Configuration & Options

Pass a target selector or element alongside an options object: `new JBSCaptcha(target, options)`.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | `'custom'` | Action preset: `'login'`, `'register'`, `'submit'`, `'pay'`, `'delete'`, `'download'`, `'custom'` |
| `direction` | `string` | `'horizontal'` | Sliding direction: `'horizontal'`, `'vertical'`, `'2d'` |
| `size` | `string` | `'md'` | Component size: `'sm'`, `'md'`, `'lg'` |
| `shape` | `string` | `'circle'` | Slider button shape: `'circle'`, `'square'` |
| `theme` | `string` | `'auto'` | Color theme: `'auto'`, `'light'`, `'dark'` |
| `label` | `string` | Preset dependent | Initial text prompt on the slider track |
| `verifiedText` | `string` | Preset dependent | Text displayed upon successful completion |
| `pendingText` | `string` | Preset dependent | Text displayed during verification processing |
| `auto` | `boolean` | `true` | Auto-clicks target button on success if no `onSuccess` callback is set |
| `accessibility` | `string` | `'on'` | Accessibility panel visibility: `'on'`, `'off'`, `'always'` |
| `audioSonar` | `boolean` | `true` | Enables Web Audio API proximity pitch feedback for accessibility |
| `randomStart` | `boolean` | `true` | Randomizes initial slider start position and target destination |
| `tolerance` | `number` | `16` | Snap/match margin of error in pixels |
| `onBeforeStart` | `function` | `null` | Pre-validation hook `() => boolean`. Must return `true` to allow sliding |
| `validationErrorText` | `string` | `"Please fill out required form fields first"` | Tooltip error message displayed when `onBeforeStart` fails |
| `onSuccess` | `function` | `null` | Callback executed immediately when verification succeeds |
| `colors` | `object` | `{}` | Custom color overrides (e.g. `{ primary: '#00f3ff', track: '#1e293b' }`) |

---

## 📖 Advanced Usage & Examples

### Async / Promise-Based Verification

`JBSCaptcha` exposes a native Promise via `captcha.promise` that resolves when the CAPTCHA is solved:

```javascript
const captcha = new JBSCaptcha('#captcha-container', { type: 'submit' });

// Wait for verification completion
await captcha.promise;
console.log('Verification completed asynchronously!');
```

### Pre-Form Validation (`onBeforeStart`)

Prevent users from completing the CAPTCHA before filling required form inputs:

```javascript
new JBSCaptcha('#submitBtn', {
    type: 'register',
    onBeforeStart: () => {
        const form = document.querySelector('#registerForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false; // Blocks CAPTCHA drag
        }
        return true;
    }
});
```

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).
