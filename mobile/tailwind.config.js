/** @type {import('tailwindcss').Config} */
// Mọi token thiết kế nằm ở src/theme/tokens.json – đây là nơi duy nhất cần sửa.
const tokens = require('./src/theme/tokens.json');

const px = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, `${v}px`]));

const fontSize = Object.fromEntries(
  Object.entries(tokens.fontSize).map(([k, [size, lineHeight]]) => [
    k,
    [`${size}px`, { lineHeight: `${lineHeight}px` }],
  ]),
);

module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      // Tên lớp: font-body, font-body-medium, font-body-semibold, font-body-bold.
      // Không dùng "font-medium"... để tránh trùng lớp độ đậm của Tailwind.
      // font-display: chữ thương hiệu ZomZom (Baloo 2).
      fontFamily: {
        ...Object.fromEntries(
          Object.entries(tokens.fontFamily).map(([k, v]) => [k === 'regular' ? 'body' : `body-${k}`, [v]]),
        ),
        display: [tokens.fontFamilyDisplay],
      },
      fontSize,
      borderRadius: px(tokens.radius),
      boxShadow: tokens.shadow,
      height: px(tokens.size),
      minHeight: px(tokens.size),
      width: px(tokens.size),
      minWidth: px(tokens.size),
    },
  },
  plugins: [],
};
