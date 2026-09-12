/** Tailwind build config.
 *
 * The game ships a prebuilt stylesheet (tailwind.css) so it works with no
 * network: open index.html and play. Rebuild after changing classes in the
 * markup or the script:
 *
 *   npm install && npm run build:css
 */
module.exports = {
  content: ['./index.html', './script.js'],
  theme: { extend: {} },
  plugins: []
};
