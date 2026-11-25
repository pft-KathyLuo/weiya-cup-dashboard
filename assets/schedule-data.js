/**
 * 賽程表資料。改日期只要改這裡。
 * dates：比賽日（YYYY-MM-DD）。報名階段用 until 表示截止日。
 * color：這個階段在時間軸與小月曆上的顏色（同一個藍綠色系，越後面越深；決賽用網站的金色）。
 * 頁面會依照今天日期自動標示「已結束／進行中／即將開始」，小月曆的月份也會自動算出來。
 */
var STAGES = [
    { zh: '報名', en: 'Registration', until: '2026-12-11', color: '#cfe6dc' },
    { zh: '海選', en: 'Qualifiers', dates: ['2026-12-17', '2026-12-18', '2026-12-21'], note: '取前 64 隊', noteEn: 'Top 64 teams advance', color: '#8fcdb9' },
    { zh: '64 強 → 32 強', en: 'Round of 64', dates: ['2026-12-24', '2026-12-28'], color: '#4fae96' },
    { zh: '32 強 → 16 強', en: 'Round of 32', dates: ['2027-01-04'], color: '#1f907e' },
    { zh: '16 強 → 8 強', en: 'Round of 16', dates: ['2027-01-07'], color: '#087f72' },
    { zh: '8 強 → 4 強', en: 'Quarterfinals', dates: ['2027-01-08'], color: '#0a5c52' },
    { zh: '決賽', en: 'Finals', dates: ['2027-01-15'], note: '尾牙當天', noteEn: 'At the year-end party', final: true, color: '#e9b451' },
  ];
