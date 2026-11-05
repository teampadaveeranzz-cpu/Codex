(() => {
  const root = '/assets/site-photos/';
  const treatment = document.createElement('style');
  treatment.textContent = '.venue-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(.88) contrast(.98);transform:scale(1.015)}.venue-art.has-photo .venue-vignette{background:linear-gradient(180deg,rgba(8,23,19,.08),rgba(8,23,19,.02) 32%,rgba(8,23,19,.38) 61%,rgba(8,23,19,.94)),linear-gradient(90deg,rgba(8,23,19,.12),transparent 50%,rgba(8,23,19,.06))}.venue-art.has-photo .venue-robot{display:none}.hero-photo{object-fit:cover;object-position:center 43%;border-radius:200px 200px 20px 20px;opacity:.97;filter:saturate(.92)}.robot-group-photo{display:block;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:24px;filter:saturate(.9)}';
  document.head.append(treatment);
  const robotPhotos = {
    'Z-01 advertising robot': ['advertising-robot.jpeg', 'ZEVON advertising robot'],
    'Z-02 serving robot': ['serving-robot.jpeg', 'ZEVON serving robot'],
    'Z-03 companion robot': ['companion-robot.jpeg', 'ZEVON companion robot']
  };
  const venuePhotos = {
    'Hotels & Restaurants': ['restaurant-service.jpeg', 'Serving robot in a restaurant'],
    'Shopping Malls': ['mall-atrium.jpeg', 'Advertising robot in a shopping mall'],
    'Corporate Offices': ['hotel-lobby.jpeg', 'Advertising robot in a modern lobby'],
    'Exhibitions & Trade Fairs': ['exhibition-floor.jpeg', 'Advertising robot at an exhibition'],
    'Retail Stores': ['luxury-mall.jpeg', 'Advertising robot in a luxury retail space'],
    'Marketing Campaigns': ['robot-lineup.jpeg', 'ZEVON robot range together'],
    'Hospitality & Family Venues': ['family-play.jpeg', 'Children playing with a companion robot']
  };
  function photo(src, alt, className) {
    const img = document.createElement('img');
    img.src = root + src;
    img.alt = alt;
    img.loading = 'lazy';
    img.className = className;
    return img;
  }
  function applyPhotos() {
    document.querySelectorAll('.robot svg[aria-label]').forEach(svg => {
      const wrapper = svg.parentElement;
      if (wrapper.querySelector('img')) return;
      const label = svg.getAttribute('aria-label').toLowerCase();
      const entry = Object.entries(robotPhotos).find(([key]) => label.includes(key.toLowerCase()));
      if (!entry) return;
      const [src, alt] = entry[1];
      wrapper.replaceChildren(photo(src, alt, 'uploaded-robot'));
      wrapper.classList.add('photo-robot');
    });
    document.querySelectorAll('.venue-card,.venue-card-home,.venue-dialog-content').forEach(card => {
      const title = (card.querySelector('.venue-copy h3') || card.querySelector('.venue-dialog-copy h2'))?.textContent.trim();
      const entry = venuePhotos[title];
      const art = card.querySelector('.venue-art');
      if (!entry || !art || art.querySelector('.venue-photo')) return;
      art.classList.add('has-photo');
      const shade = document.createElement('div');
      shade.className = 'venue-vignette';
      art.replaceChildren(photo(entry[0], entry[1], 'venue-photo'), shade);
    });
    const hero = document.querySelector('section.hero:not(.page-hero) .hero-arch');
    if (hero && !hero.querySelector('.hero-photo')) {
      hero.querySelector('.robot')?.remove();
      hero.prepend(photo('mall-atrium.jpeg', 'Advertising robot in a shopping mall', 'hero-photo'));
    }
    document.querySelectorAll('.split-visual.group').forEach(group => {
      if (group.querySelector('.robot-group-photo')) return;
      group.replaceChildren(photo('robot-lineup.jpeg', 'ZEVON advertising, serving and companion robots together', 'robot-group-photo'));
    });
  }
  const observer = new MutationObserver(applyPhotos);
  observer.observe(document.body, { childList: true, subtree: true });
  applyPhotos();
})();
