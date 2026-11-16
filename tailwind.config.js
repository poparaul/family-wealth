/** Generează css/tailwind.css din clasele folosite în index.html și js/*.js:
 *   npx tailwindcss@3.4.16 -i css/tailwind.input.css -o css/tailwind.css --minify
 */
module.exports = { content: ["./index.html", "./js/**/*.js"], theme: { extend: {} }, plugins: [] };
