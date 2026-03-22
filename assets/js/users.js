// ── assets/js/users.js — Vue application for the Users page ──────────────────
//
// This file is loaded AFTER vue.global.js (the CDN script), so the global
// 'Vue' object already exists on window by the time this code runs.
//
// It is also loaded AFTER main.js, so renderFooter() and initNav() have
// already run and the header/footer are in the DOM.
// ─────────────────────────────────────────────────────────────────────────────


// ── VUE 3 COMPOSITION API ─────────────────────────────────────────────────────
//
// When using the CDN build (not npm/Vite), all Vue exports live on the
// global Vue object. We destructure the three things we need:
//
//   createApp   — creates a Vue application instance
//   ref         — creates a reactive reference (reactive single value)
//   onMounted   — lifecycle hook: runs after the component is in the DOM
//
// In a Vite/npm project you'd write:
//   import { createApp, ref, onMounted } from 'vue'
// The API is identical — only the import syntax differs.
const { createApp, ref, onMounted } = Vue;


createApp({
  // ── setup() ───────────────────────────────────────────────────────────────
  // setup() is the entry point of the Composition API.
  // It runs once when the component is initialised, before the DOM exists.
  // Everything you declare here and return is available in the template.
  setup() {

    // ── REACTIVE STATE ───────────────────────────────────────────────────────
    //
    // ref() wraps a value in a reactive container.
    // - Inside setup(): access or mutate it with .value
    //   e.g.  users.value = data;
    // - Inside the template: Vue automatically unwraps it — write {{ users }}
    //   not {{ users.value }}
    //
    // When .value changes, Vue schedules a re-render of any template
    // expressions that depend on that ref. This is "reactivity" —
    // the UI stays in sync with the data automatically.
    const users   = ref([]);    // will hold the array of user objects from the API
    const loading = ref(true);  // true = fetch is in progress → show spinner
    const error   = ref(null);  // null = no error; string = error message to display


    // ── onMounted ─────────────────────────────────────────────────────────────
    //
    // Lifecycle hooks let you run code at specific moments in a component's life:
    //   onMounted   — after the component is inserted into the real DOM
    //   onUnmounted — after the component is removed from the DOM
    //   onUpdated   — after a reactive change causes a re-render
    //
    // WHY onMounted for fetch()?
    //   setup() runs before the DOM exists. If you put fetch() directly
    //   in setup() it would work, but onMounted is the conventional place
    //   for "side effects" (network requests, timers, DOM access) because
    //   it makes the timing explicit and mirrors the Options API 'mounted' hook.
    //
    // 'async' keyword lets us use 'await' inside the function.
    onMounted(async () => {
      try {
        // fetch() is a browser built-in that makes an HTTP request.
        // It returns a Promise — await pauses until the response headers arrive.
        //
        // The Express server must be running:  node server/index.js
        // It must be served via http:// (not file://) to avoid CORS issues.
        const response = await fetch('http://localhost:3000/api/users');

        // response.ok is true for 2xx status codes (200, 201, etc.)
        // It is false for 4xx (client errors) and 5xx (server errors).
        if (!response.ok) {
          throw new Error(`Server replied with status ${response.status}`);
        }

        // response.json() parses the response body as JSON — also a Promise.
        // The Express server sent:  res.json(result.rows)
        // So data is an array of objects: [{ id, name, email, active }, ...]
        const data = await response.json();

        // Assigning to .value triggers Vue's reactivity system.
        // Vue sees 'users' changed → re-evaluates the template → updates the DOM.
        // The v-for loop now renders a row for each user.
        users.value = data;

      } catch (err) {
        // fetch() throws on network errors (server not running, DNS failure, etc.)
        // We catch those here and store a human-readable message.
        error.value = 'Could not load users. Is the Express server running on port 3000?';
        console.error(err);

      } finally {
        // 'finally' runs whether try succeeded or catch ran.
        // Always set loading to false here so the spinner disappears.
        loading.value = false;
      }
    });


    // ── RETURN VALUES ──────────────────────────────────────────────────────────
    //
    // setup() must return an object containing everything the template uses.
    // Vue makes these available as template variables.
    // If you forget to return something, the template can't see it.
    return { users, loading, error };
  }

// .mount('#app') connects this Vue application to the <section id="app">
// element in the HTML. Vue takes control of that element and all its children,
// evaluating all v-if, v-for, {{ }} expressions it finds inside.
}).mount('#app');
