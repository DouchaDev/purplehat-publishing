// ── assets/js/auth.js — Sign In / Sign Up modal ───────────────────────────────
//
// Vue 3 app (CDN pattern, same as users.js).
// Mounts on <div id="auth-modal-app"> which initAuth() in main.js injects into <body>.
//
// WHAT THIS FILE DOES:
//   - Owns the sign in / sign up modal UI and all form state
//   - Calls POST /api/auth/signin or POST /api/auth/signup
//   - On success: stores the JWT in localStorage, updates the nav
//   - Exposes window.authApp so main.js click handlers can open the modal
//     and trigger sign-out from the nav button
//
// LOAD ORDER (enforced by script tag order in HTML):
//   1. vue.global.js  — sets window.Vue
//   2. main.js        — calls renderNav() + initAuth(), sets up nav buttons
//   3. auth.js        — mounts Vue app, sets window.authApp
//   The sign-in button click is a user action, so authApp is always set by then.
// ─────────────────────────────────────────────────────────────────────────────

const { createApp, ref, computed } = Vue;

// API base URL — change this if your Express server runs on a different port
const API = 'http://localhost:3000/api/auth';

// Maps error codes returned by the server to human-readable messages.
// The server sends short machine-readable codes (e.g. 'invalid_credentials')
// so the client decides how to phrase them for the user.
const ERROR_MESSAGES = {
  invalid_credentials: 'Incorrect email or password.',
  email_taken:         'That email is already registered.',
  no_password_set:     'This account has no password yet — use Sign Up to set one.',
  cannot_demote_self:  'You cannot remove your own admin role.',
};

// Why DOMContentLoaded here?
// Scripts at the bottom of <body> run BEFORE DOMContentLoaded fires.
// main.js registers its DOMContentLoaded listener first (it loads first), so when
// DOMContentLoaded fires, main.js runs initAuth() which creates #auth-modal-app.
// Only THEN does our listener run and find the element to mount onto.
// Without this wrapper, .mount('#auth-modal-app') would silently fail because
// the element doesn't exist yet, setup() would never run, and window.authApp
// would never be set — so clicking Sign In would do nothing.
document.addEventListener('DOMContentLoaded', () => {

createApp({
  // ── TEMPLATE ────────────────────────────────────────────────────────────────
  // The template is defined inline here (no separate .html file).
  // Vue compiles it at runtime from this string — valid because we're using the
  // CDN "global build" which includes the template compiler.
  // In a Vite/npm project you'd use a .vue Single File Component instead.
  template: `
    <!-- Backdrop: clicking outside the card closes the modal -->
    <div v-if="isOpen" class="auth-modal-backdrop" @click.self="close" role="dialog" aria-modal="true" :aria-labelledby="'auth-title-' + mode">

      <div class="auth-modal">

        <!-- Close button -->
        <button class="auth-modal-close" @click="close" aria-label="Close">&times;</button>

        <!-- Heading changes based on mode -->
        <h2 :id="'auth-title-' + mode" class="auth-modal-heading">
          {{ mode === 'signin' ? 'Sign In' : 'Create Account' }}
        </h2>

        <!-- Gold divider — reuses site-wide .gold-divider class -->
        <div class="gold-divider" style="margin: 0 auto 0"></div>

        <!-- Form — @submit.prevent stops the browser's default page reload -->
        <form @submit.prevent="handleSubmit" class="auth-form" novalidate>

          <!-- Name field — only shown for sign up -->
          <!-- v-if inserts/removes the element entirely (not just hides it) -->
          <div v-if="mode === 'signup'" class="auth-field">
            <label for="auth-name">Name</label>
            <!-- v-model = two-way binding: input updates 'name' ref, and
                 if 'name' ref changes, the input value updates too -->
            <input id="auth-name" v-model="name" type="text"
                   autocomplete="name" placeholder="Your name" required>
          </div>

          <div class="auth-field">
            <label for="auth-email">Email</label>
            <input id="auth-email" v-model="email" type="email"
                   autocomplete="email" placeholder="you@example.com" required>
          </div>

          <div class="auth-field">
            <label for="auth-password">Password</label>
            <!-- :autocomplete is dynamic — 'current-password' for sign in,
                 'new-password' for sign up. This hints to the browser's
                 password manager which action is being taken. -->
            <input id="auth-password" v-model="password" type="password"
                   :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                   placeholder="Min 8 characters" required>
          </div>

          <!-- Error message — role="alert" makes screen readers announce it -->
          <p v-if="error" class="auth-error" role="alert">{{ errorMessage }}</p>

          <!-- Submit button — disabled while the fetch is in progress -->
          <button type="submit" class="btn btn-primary auth-submit" :disabled="submitting">
            <!-- Show spinner icon while submitting, text otherwise -->
            <i v-if="submitting" class="fas fa-circle-notch fa-spin"></i>
            <span v-else>{{ mode === 'signin' ? 'Sign In' : 'Sign Up' }}</span>
          </button>

        </form>

        <!-- Switch between modes -->
        <p class="auth-switch">
          <span v-if="mode === 'signin'">
            No account?
            <!-- @click changes the mode ref — Vue re-renders automatically -->
            <button class="auth-link-btn" @click="mode = 'signup'">Sign Up</button>
          </span>
          <span v-else>
            Already have one?
            <button class="auth-link-btn" @click="mode = 'signin'">Sign In</button>
          </span>
        </p>

      </div>
    </div>
  `,

  // ── SETUP ────────────────────────────────────────────────────────────────────
  setup() {

    // ── REACTIVE STATE ─────────────────────────────────────────────────────────
    const mode      = ref('signin');  // 'signin' | 'signup'
    const isOpen    = ref(false);
    const name      = ref('');
    const email     = ref('');
    const password  = ref('');
    const error     = ref(null);      // null | server error code string
    const submitting = ref(false);    // true while fetch is in-flight


    // ── COMPUTED ───────────────────────────────────────────────────────────────
    //
    // computed() creates a derived value that updates automatically when its
    // dependencies change. Here, errorMessage re-computes whenever error.value changes.
    // It maps the server's machine-readable error code to a user-facing sentence.
    const errorMessage = computed(() =>
      ERROR_MESSAGES[error.value] ?? 'Something went wrong. Please try again.'
    );


    // ── METHODS ────────────────────────────────────────────────────────────────

    function open(initialMode = 'signin') {
      mode.value     = initialMode;
      name.value     = '';
      email.value    = '';
      password.value = '';
      error.value    = null;
      isOpen.value   = true;
      // Prevent background scroll while modal is open
      document.body.style.overflow = 'hidden';
    }

    function close() {
      isOpen.value = false;
      document.body.style.overflow = '';
    }

    function signOut() {
      localStorage.removeItem('ph_token');
      // Reload to home — clears any protected page state
      window.location.href = 'index.html';
    }

    // handleSubmit() dispatches to the correct fetch based on the current mode
    async function handleSubmit() {
      error.value    = null;
      submitting.value = true;

      try {
        if (mode.value === 'signin') {
          await doSignIn();
        } else {
          await doSignUp();
        }
      } finally {
        // Always re-enable the button, whether the request succeeded or failed
        submitting.value = false;
      }
    }

    async function doSignIn() {
      const res = await fetch(`${API}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value, password: password.value }),
      });

      const data = await res.json();

      if (!res.ok) {
        // res.ok is false for 4xx/5xx. Store the error code for errorMessage computed.
        error.value = data.error ?? 'unknown';
        return;
      }

      onAuthSuccess(data.token, data.user);
    }

    async function doSignUp() {
      const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     name.value,
          email:    email.value,
          password: password.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        error.value = data.error ?? 'unknown';
        return;
      }

      onAuthSuccess(data.token, data.user);
    }

    // Called on successful sign in or sign up
    function onAuthSuccess(token, user) {
      // Store the JWT so it persists across page loads
      localStorage.setItem('ph_token', token);

      // Update the nav — renderNavLoggedIn is defined in main.js.
      // Because main.js is loaded before auth.js, it's always available.
      renderNavLoggedIn(user);

      close();
    }


    // ── EXPOSE TO main.js ──────────────────────────────────────────────────────
    //
    // window.authApp is read by the sign-in button click handler in main.js
    // (renderNavLoggedOut) and the sign-out button (renderNavLoggedIn).
    // We set it here inside setup() after all methods are defined.
    //
    // Note: this runs synchronously when auth.js executes, before any user
    // interaction — so by the time anyone clicks Sign In, authApp is ready.
    window.authApp = { open, signOut };


    // Everything returned here is available in the template above
    return { mode, isOpen, name, email, password, error, submitting, errorMessage, close, handleSubmit };
  }

}).mount('#auth-modal-app');

}); // end DOMContentLoaded
