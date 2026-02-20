// ─────────────────────────────────────────────────────────────────────────────
// ALBUMS MANIFEST
// Add your albums here. Each album = one object in this array.
//
// File structure expected:
//   music/
//     folder-name/
//       cover.jpg
//       01 - Track Name.mp3
//       02 - Track Name.mp3
// ─────────────────────────────────────────────────────────────────────────────

const ALBUMS = [
  {
    title: "КирюхаНаБите",
    artist: "Секретный Фанат",
    year: 2026,
    cover: "music/KiryuxaOnTheBit/cover.jpg",
    tracks: [
      { title: "Впереди ничего нет",         file: "music/KiryuxaOnTheBit/01-Впереди-ничего-нет.mp3" },
      { title: "О Кирилл прости нас",        file: "music/KiryuxaOnTheBit/02-О-Кирилл-прости-Нас.mp3" },
      { title: "Кирилл дал газу",            file: "music/KiryuxaOnTheBit/03-Кирилл-дал-газу.mp3" },
    ]
  },

  // Пример второго альбома — раскомментируй и заполни:
  //
  // {
  //   title: "Album Title",
  //   artist: "Artist Name",
  //   year: 2023,
  //   cover: "music/folder-name/cover.jpg",
  //   tracks: [
  //     { title: "Track 1", file: "music/folder-name/01-track.mp3" },
  //     { title: "Track 2", file: "music/folder-name/02-track.mp3" },
  //   ]
  // },
];
