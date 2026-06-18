/* ====================================================
   COMPONENT DATA
   Zentrale Datenquelle für alle Komponenten-Sektionen.
   Trennt Inhalt von Darstellung — neue Komponenten
   lassen sich einfach durch neue Einträge ergänzen.
   ==================================================== */

export const COMPONENTS = [
  {
    id: 'cpu',
    index: '01',
    name: 'CPU — Der Prozessor',
    tagline: 'Das Gehirn, das niemals aufhört zu rechnen',
    description: `Die <strong>CPU (Central Processing Unit)</strong> ist der
      universelle Rechenkern deines Systems. Milliarden Transistoren,
      kleiner als ein Virus, schalten sich Milliarden Mal pro Sekunde —
      jede Schaltung eine winzige Entscheidung in einer Kette aus Nullen
      und Einsen, die am Ende zu einem Mausklick, einem Spiel-Frame oder
      einer Google-Suche wird.`,
    specs: [
      { label: 'Fertigung', value: '3–5 nm' },
      { label: 'Kerne', value: '6–24 Cores' },
      { label: 'Takt', value: '3.5–6.0 GHz' },
      { label: 'TDP', value: '65–250 W' },
    ],
    layers: [
      { name: 'IHS (Deckel)', desc: 'Metallabdeckung, verteilt Wärme gleichmäßig zum Kühler.' },
      { name: 'Die (Silizium)', desc: 'Der eigentliche Chip — hier passiert die Berechnung.' },
      { name: 'Cores', desc: 'Unabhängige Recheneinheiten für parallele Aufgaben.' },
      { name: 'Cache (L1-L3)', desc: 'Ultraschneller Zwischenspeicher direkt am Kern.' },
      { name: 'IMC', desc: 'Memory Controller — Brücke zum Arbeitsspeicher.' },
      { name: 'Pins / Pads', desc: 'Tausende Kontaktpunkte zum Mainboard-Sockel.' },
    ],
    modelBuilder: 'buildCPU',
    color: 0x00D9FF,
  },
  {
    id: 'gpu',
    index: '02',
    name: 'GPU — Die Grafikkarte',
    tagline: 'Tausende kleine Rechner, ein gemeinsames Bild',
    description: `Während eine CPU wenige Aufgaben extrem schnell löst,
      löst eine <strong>GPU</strong> tausende einfache Aufgaben gleichzeitig.
      Genau das brauchen Pixel: Jeder einzelne muss berechnet werden —
      Licht, Schatten, Reflexion — und das 60 bis 240 Mal pro Sekunde,
      für jeden Pixel auf deinem Bildschirm parallel.`,
    specs: [
      { label: 'Shader-Kerne', value: '2.560–16.384' },
      { label: 'VRAM', value: '8–24 GB GDDR6/X' },
      { label: 'Bus-Breite', value: '128–384 bit' },
      { label: 'TDP', value: '150–450 W' },
    ],
    layers: [
      { name: 'GPU-Die', desc: 'Der Grafikchip selbst, oft größer als eine CPU.' },
      { name: 'VRAM-Module', desc: 'Dedizierter Speicher rund um den Chip für Texturen.' },
      { name: 'PCB', desc: 'Leiterplatte, die Strom & Daten verteilt.' },
      { name: 'VRMs', desc: 'Spannungswandler — regeln die Stromversorgung präzise.' },
      { name: 'Heatpipes', desc: 'Kupferrohre leiten Wärme zu den Lüftern ab.' },
      { name: 'Backplate', desc: 'Stabilisiert die Karte & unterstützt Kühlung.' },
    ],
    modelBuilder: 'buildGPU',
    color: 0xFF6B35,
  },
  {
    id: 'ram',
    index: '03',
    name: 'RAM — Arbeitsspeicher',
    tagline: 'Das Kurzzeitgedächtnis, das alles bereithält',
    description: `<strong>RAM</strong> speichert nichts dauerhaft — sondern
      genau das, was die CPU im nächsten Moment braucht. Anders als
      Festplatten verliert er beim Ausschalten seinen Inhalt komplett,
      dafür ist er tausendfach schneller. Ein ständiger Kompromiss zwischen
      Geschwindigkeit und Vergänglichkeit.`,
    specs: [
      { label: 'Typ', value: 'DDR5' },
      { label: 'Kapazität', value: '8–32 GB / Modul' },
      { label: 'Taktrate', value: '4800–8000 MT/s' },
      { label: 'Latenz', value: 'CL30–CL40' },
    ],
    layers: [
      { name: 'PCB-Modul', desc: 'Die grüne/schwarze Platine, die alles trägt.' },
      { name: 'DRAM-Chips', desc: 'Speicherzellen — jede hält ein Bit als Ladung.' },
      { name: 'SPD-Chip', desc: 'Speichert Timing-Infos für das Mainboard.' },
      { name: 'PMIC', desc: 'Eigener Spannungsregler direkt auf dem Modul (DDR5).' },
      { name: 'Goldkontakte', desc: 'Die Steckverbindung zum RAM-Slot.' },
      { name: 'Heatspreader', desc: 'Oft kosmetisch, hilft aber bei Übertaktung.' },
    ],
    modelBuilder: 'buildRAM',
    color: 0x3DDC97,
  },
  {
    id: 'storage',
    index: '04',
    name: 'SSD — Datenspeicher',
    tagline: 'Wo alles bleibt, wenn der Strom weg ist',
    description: `Im Gegensatz zu RAM ist eine <strong>SSD</strong> dafür
      gebaut, Daten dauerhaft zu halten. Statt rotierender Magnetscheiben
      wie früher bei HDDs steckt heute reine Flash-Logik dahinter —
      keine beweglichen Teile, dafür Ladungszustände in Millionen winziger
      Speicherzellen, die selbst nach Jahren ohne Strom erhalten bleiben.`,
    specs: [
      { label: 'Schnittstelle', value: 'PCIe 4.0/5.0 NVMe' },
      { label: 'Lesegeschw.', value: 'bis 14.000 MB/s' },
      { label: 'Kapazität', value: '256 GB – 8 TB' },
      { label: 'Formfaktor', value: 'M.2 2280' },
    ],
    layers: [
      { name: 'Controller-Chip', desc: 'Organisiert, wo Daten auf den Zellen liegen.' },
      { name: 'NAND-Flash', desc: 'Die eigentlichen Speicherchips — gestapelt in Lagen.' },
      { name: 'DRAM-Cache', desc: 'Kleiner Puffer-Speicher für schnellere Zugriffe.' },
      { name: 'PCB', desc: 'Schlanke Platine im M.2-Formfaktor.' },
      { name: 'Heatspreader', desc: 'Bei High-End-SSDs gegen Thermal Throttling.' },
      { name: 'Goldkontakte', desc: 'Direkter Anschluss an die PCIe-Lanes.' },
    ],
    modelBuilder: 'buildSSD',
    color: 0x00D9FF,
  },
  {
    id: 'mainboard',
    index: '05',
    name: 'Mainboard',
    tagline: 'Platzhalter — Kapitel folgt',
    description: `Das <strong>Mainboard</strong> ist die zentrale Plattform,
      die jede andere Komponente verbindet. Dieses Kapitel wird in einer
      zukünftigen Ausbaustufe mit einem vollständigen 3D-Modell und
      einer Tiefenanalyse der Chipsatz-Topologie ergänzt.`,
    specs: [
      { label: 'Status', value: 'In Planung' },
      { label: 'Formfaktor', value: 'ATX / mATX / ITX' },
      { label: 'Sockel', value: 'Variiert' },
      { label: 'Chipsatz', value: 'TBD' },
    ],
    layers: [
      { name: 'Kommt bald', desc: 'Dieses Kapitel wird aktuell vorbereitet.' },
    ],
    modelBuilder: 'buildPlaceholder',
    color: 0x4A5568,
    placeholder: true,
  },
  {
    id: 'psu',
    index: '06',
    name: 'Netzteil (PSU)',
    tagline: 'Platzhalter — Kapitel folgt',
    description: `Das <strong>Netzteil</strong> wandelt Wechselstrom aus der
      Steckdose in die exakten Spannungen, die jede Komponente braucht.
      Eine vollständige Untersuchung der internen Schaltkreise ist für
      eine zukünftige Version dieser Seite vorgesehen.`,
    specs: [
      { label: 'Status', value: 'In Planung' },
      { label: 'Leistung', value: '550–1200 W' },
      { label: 'Effizienz', value: '80+ Gold/Platinum' },
      { label: 'Modularität', value: 'Variiert' },
    ],
    layers: [
      { name: 'Kommt bald', desc: 'Dieses Kapitel wird aktuell vorbereitet.' },
    ],
    modelBuilder: 'buildPlaceholder',
    color: 0x4A5568,
    placeholder: true,
  },
  {
    id: 'cooling',
    index: '07',
    name: 'Kühlung',
    tagline: 'Platzhalter — Kapitel folgt',
    description: `Ob Luft- oder Wasserkühlung — <strong>Thermal Management</strong>
      entscheidet, wie viel Leistung eine Komponente dauerhaft abrufen kann.
      Eine detaillierte Untersuchung von AIOs, Heatpipes und Wärmeleitpaste
      folgt in einem späteren Ausbauschritt.`,
    specs: [
      { label: 'Status', value: 'In Planung' },
      { label: 'Typen', value: 'Luft / AIO / Custom Loop' },
      { label: 'Radiatorgröße', value: '120–420 mm' },
      { label: 'Lautstärke', value: '15–40 dBA' },
    ],
    layers: [
      { name: 'Kommt bald', desc: 'Dieses Kapitel wird aktuell vorbereitet.' },
    ],
    modelBuilder: 'buildPlaceholder',
    color: 0x4A5568,
    placeholder: true,
  },
];
