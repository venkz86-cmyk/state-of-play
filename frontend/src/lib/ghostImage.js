// Ghost serves resized copies of its own images under /size/wN/. Anything
// not hosted by Ghost (or already resized) is returned unchanged.
export const sized = (url, width) =>
  url && url.includes('/content/images/') && !url.includes('/content/images/size/')
    ? url.replace('/content/images/', `/content/images/size/w${width}/`)
    : url;

// srcSet for a Ghost image, so phones download a phone-sized copy. Empty
// for images Ghost can't resize, where the plain src is used as before.
export const ghostSrcSet = (url, widths = [600, 1000, 1600, 2000]) =>
  url && url.includes('/content/images/') && !url.includes('/content/images/size/')
    ? widths.map((w) => `${sized(url, w)} ${w}w`).join(', ')
    : undefined;
