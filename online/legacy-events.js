// Replace original inline handlers so CSP can keep script-src-attr disabled.
'use strict';
const carouselCards = document.querySelectorAll('#carousel > div:first-child > div');
carouselCards.forEach((elem, i) => {
  const shift = i - 2;
  elem.removeAttribute('onclick'); elem.removeAttribute('onmouseover');
  elem.addEventListener('click', event => { if (shift) Carousel.curr?.shift(event, shift); else Carousel.curr?.select(event); });
  elem.addEventListener('mouseover', () => Carousel.curr?.nudge(shift));
});
document.querySelectorAll('#popup button').forEach((elem, i) => {
  elem.removeAttribute('onclick');
  elem.addEventListener('click', () => i ? Popup.curr?.selectNo() : Popup.curr?.selectYes());
});
