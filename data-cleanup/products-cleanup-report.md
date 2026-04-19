# Rapport de nettoyage produits — Alkamar Info
**Date :** 2026-04-19  
**Auteur :** Nettoyage automatisé (Claude)  
**Règle appliquée :** exactement 5 produits actifs par onglet frontend

---

## Résumé exécutif

| Action | Nombre |
|--------|--------|
| Produits archivés (excès par tab) | 8 |
| Produits orphelins archivés (sans catégorie) | 57 |
| Tabs à exactement 5 produits actifs | 34 |
| Tabs avec moins de 5 produits (à compléter) | 4 |

---

## Logique de nettoyage

1. Chaque onglet visible sur le frontend doit avoir exactement 5 produits `status=active`
2. Priorité aux produits avec galerie, features, description complète, prix > 0, nom ≤ 30 chars
3. Doublons (même produit, nom sans marque) → archiver le moins complet
4. Produits sans catégorie (orphelins) → jamais visibles sur le frontend → archiver tous

---

## Produits archivés — excès par tab

### bureau (6 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 0d11dce1-5ddc-458c-bdce-e3de493acb42 | Lenovo IdeaCentre 3 | Doublon de "Lenovo IdeaCentre 3 07ACH7" ; version moins spécifique, description plus courte |

**5 produits conservés :** Dell Inspiron 3020 Tour, Dell Inspiron 3030 SFF, Dell Inspiron 3020 SFF, Lenovo IdeaCentre 3 07ACH7, Veriton M4680G

---

### ecran-gaming (6 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 38330651-4197-4567-8c4b-0c899546a913 | ASUS ROG Swift PG279QM 27" QHD 240 Hz | Nom 37 caractères (> 30), 0 galerie, 0 features — qualité la plus faible du tab |

**5 produits conservés :** Samsung Odyssey Neo G7, Alienware AW2723DF, MSI Optix MAG274QRF-QD, LG 27GP850-B, LG UltraGear 27GS75Q-B

**⚠️ Note :** 4 des 5 produits conservés ont 0 galerie et 0 features — tab à compléter en priorité

---

### gaming (6 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 2d59e5f8-80fa-4b82-98ac-eabb199bf110 | OMEN 40L Gaming Desktop | Description la plus courte du tab (175 chars) ; 4 features seulement |

**5 produits conservés :** Legion Tower 5i Gen 8, ASUS TUF Gaming A17 RTX 4060, TUF Gaming A15 FA507NVR, Victus 15-fa1001sf, Thin GF63 12VE-023FR

---

### portables (7 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 237a9382-f5e1-408f-9e1e-4c9d9ad72067 | acer Swift Go 14 I PC Portable 14" 2.8K | Prix = 0 €, 0 galerie, nom 40 caractères (hors standard) |
| 4436bc23-e595-42a8-8f79-5d0527d89d01 | HP 15s-fq5028nf | Description la plus courte des portables valides (280 chars) ; nom générique |

**5 produits conservés :** Inspiron 15 3520, VivoBook 15 X1504VA, IdeaPad 5 15ALC05, Aspire 5 A515-57-53T2, IdeaPad 3 15ALC6

---

### souris (7 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 6f3b3426-50a2-48f8-b3bb-18b23cf4b4d8 | MX Master 3S | Doublon de "Logitech MX Master 3S" ; sans marque dans le nom, 0 galerie |
| a04c797b-2e2b-446e-b480-28e145061646 | DeathAdder V3 | Doublon de "Razer DeathAdder V3" ; sans marque dans le nom, 0 galerie |

**5 produits conservés :** G PRO X Superlight 2, Logitech MX Master 3S, G502 X, Razer DeathAdder V3, M185

---

### ssd-interne (6 → 5)
| ID | Nom | Raison |
|----|-----|--------|
| 6da06c16-640a-43a5-992e-bef43528b4e2 | Samsung 870 EVO 500 Go | Capacité la plus petite (500 Go), prix le plus bas (54,90 €) — moins pertinent à l'ère du 1+ To |

**5 produits conservés :** Samsung SSD 990 Pro 1 To NVMe, Seagate BarraCuda SSD 2 To, Samsung 980 Pro 1 To, Crucial MX500 1 To, WD Blue SN570 NVMe 1 To

---

## Produits orphelins archivés (sans catégorie — jamais visibles)

57 produits avec `category_id = NULL` archivés. Ces produits proviennent du seed initial et ne remontaient jamais dans aucun onglet frontend. Liste complète :

| Nom | Raison |
|-----|--------|
| Câble RJ45 Cat 6 — 5 m | Orphelin, 0 galerie |
| Lenovo ThinkPad T490s — Reconditionné Grade A | Orphelin, 0 galerie |
| AOC 24G2 144 Hz IPS — PROMO | Orphelin, 0 galerie |
| ASUS TUF Gaming B550-PLUS — PROMO | Orphelin, 0 galerie |
| HyperX Cloud Alpha — PROMO | Orphelin, 0 galerie |
| HP EliteBook 840 G6 — Reconditionné Grade A | Orphelin, 0 galerie |
| Apple MacBook Pro 13" 2019 — Reconditionné Grade A | Orphelin, 0 galerie |
| Lenovo IdeaPad 5 i7 — Reconditionné Grade A | Orphelin, 0 galerie |
| Lenovo ThinkCentre M920 Tiny — Reconditionné | Orphelin, 0 galerie |
| Apple Mac Mini M1 8 Go — Reconditionné Grade A | Orphelin, 0 galerie |
| Dell P2723QE 27" 4K USB-C — Reconditionné Grade A | Orphelin, 0 galerie |
| HP Z24n 24" WUXGA IPS — Reconditionné Grade A | Orphelin, 0 galerie |
| LG 34WN80C 34" UltraWide QHD — Reconditionné A | Orphelin, 0 galerie |
| Samsung 32" Curved Full HD — Reconditionné Grade B | Orphelin, 0 galerie |
| Apple iPhone 12 64 Go — Reconditionné Grade A | Orphelin, 0 galerie |
| Samsung Galaxy S22 128 Go — Reconditionné Grade A | Orphelin, 0 galerie |
| Google Pixel 7 128 Go — Reconditionné Grade A | Orphelin, 0 galerie |
| HP ProDesk 600 G4 — Reconditionné Grade A | Orphelin, 0 galerie |
| TP-Link Archer AX73 — PROMO | Orphelin, 0 galerie |
| Apple iPhone SE 3e gen — Reconditionné Grade A | Orphelin, 0 galerie |
| Samsung 870 EVO 1 To — PROMO | Orphelin, 0 galerie |
| SanDisk Extreme Pro 2 To — PROMO | Orphelin, 0 galerie |
| ASUS VG279QM 27" Full HD 280 Hz — Reconditionné A | Orphelin, 0 galerie |
| Logitech MX Master 3S — PROMO | Orphelin, 0 galerie |
| Synology DS223j NAS 2 baies — PROMO | Orphelin, 0 galerie |
| SanDisk Ultra 256 Go USB 3.0 — PROMO | Orphelin, 0 galerie |
| Corsair Vengeance DDR5 32 Go — PROMO | Orphelin, 0 galerie |
| HP Z2 Tower G4 Workstation — Reconditionné | Orphelin, 0 galerie |
| Dell OptiPlex 7060 — Reconditionné Grade A | Orphelin, 0 galerie |
| Dell Latitude 5490 — Reconditionné Grade B | Orphelin, 0 galerie |
| Sauvegarde et Récupération de Données | Orphelin |
| Répéteur Wi-Fi TP-Link | Orphelin |
| Routeur Wi-Fi TP-Link AC1200 | Orphelin |
| Switch Réseau 5 Ports | Orphelin |
| Remplacement SSD | Orphelin |
| Écran Dell 24 pouces Full HD | Orphelin |
| APC P6W Parafoudre 6 prises | Orphelin |
| Disque Dur Externe 1 To | Orphelin |
| Eaton Ellipse ECO 650 VA | Orphelin |
| Targus Drifter II Sac à dos 15,6" | Orphelin |
| Kensington MicroSaver Antivol Nano | Orphelin |
| Mémoire RAM DDR4 8 Go | Orphelin |
| Samsung Galaxy A53 128 Go — Reconditionné Grade A | Orphelin |
| Clé USB 64 Go | Orphelin |
| SSD Kingston 480 Go | Orphelin |
| Alimentation PC 500W | Orphelin |
| Nettoyage et Optimisation PC | Orphelin |
| Installation Windows | Orphelin |
| Suppression Virus et Malware | Orphelin |
| Bitdefender Total Security — 5 PC, 1 an | Orphelin |
| Carte Wi-Fi USB AC | Orphelin |
| Clavier Logitech USB | Orphelin |
| Souris Sans Fil Logitech | Orphelin |
| Webcam Full HD 1080p | Orphelin |
| Casque Micro USB | Orphelin |
| ASUS V500SV (brouillon) | Orphelin, draft |
| Lexar D40E 128 Go (brouillon) | Orphelin, draft |

---

## Onglets incomplets — action requise

### cable (4/5 actifs)
**Manque :** 1 produit câble réseau conforme  
**Action :** créer ou importer un 5e câble (ex: câble Cat7 ou câble fibre)

### essentiel (4/5 actifs)
**Manque :** 1 produit essentiel montage conforme  
**Action :** créer un 5e produit (ex: connecteur SATA, pasta thermique, kit tournevis supplémentaire)

### protection (0/5 actifs)
**Catégorie :** protection  
**Page frontend :** protection.html (initFlat)  
**Manque :** 5 produits complets avec galerie, features, specs  
**Action :** créer 5 produits de protection (antivirus, onduleur, parafoudre, sac, câble antivol) avec photos Amazon

### service (0/5 actifs)
**Catégorie :** service  
**Page frontend :** services.html (initFlat)  
**Manque :** 5 produits service complets  
**Action :** créer 5 fiches service (installation, nettoyage, réparation, récupération données, diagnostic)

---

## État final par onglet

| Page | Tab/Slug | Actifs | État |
|------|----------|--------|------|
| ordinateurs.html | portables | 5 | ✅ |
| ordinateurs.html | bureau | 5 | ✅ |
| ordinateurs.html | gaming | 5 | ✅ |
| ordinateurs.html | toutunun | 5 | ✅ |
| ordinateurs.html | reconditiones | 5 | ✅ |
| ordinateurs.html | minipc | 5 | ✅ |
| composants.html | cpu | 5 | ✅ |
| composants.html | gpu | 5 | ✅ |
| composants.html | ram | 5 | ✅ |
| composants.html | cartemere | 5 | ✅ |
| composants.html | alimentation | 5 | ✅ |
| composants.html | boitier | 5 | ✅ |
| composants.html | refroidissement | 5 | ✅ |
| composants.html | essentiel | 4 | ⚠️ manque 1 |
| stockage.html | ssd-interne | 5 | ✅ |
| stockage.html | ssd-externe | 5 | ✅ |
| stockage.html | hdd | 5 | ✅ |
| stockage.html | cle-usb | 5 | ✅ |
| stockage.html | carte-memoire | 5 | ✅ |
| stockage.html | nas | 5 | ✅ |
| ecrans.html | ecran-fhd | 5 | ✅ |
| ecrans.html | ecran-4k | 5 | ✅ |
| ecrans.html | ecran-gaming | 5 | ✅ ⚠️ (4 sans galerie) |
| ecrans.html | ecran-reco | 5 | ✅ |
| peripheriques.html | clavier | 5 | ✅ |
| peripheriques.html | souris | 5 | ✅ |
| peripheriques.html | casque | 5 | ✅ |
| peripheriques.html | webcam | 5 | ✅ |
| peripheriques.html | imprimante | 5 | ✅ |
| peripheriques.html | onduleur | 5 | ✅ |
| reseau.html | routeur-wifi | 5 | ✅ |
| reseau.html | routeur-4g5g | 5 | ✅ |
| reseau.html | switch | 5 | ✅ |
| reseau.html | point-acces | 5 | ✅ |
| reseau.html | cable | 4 | ⚠️ manque 1 |
| reseau.html | essentiel-reseau | 5 | ✅ |
| reconditionnes.html | reco-portable | 5 | ✅ |
| reconditionnes.html | reco-bureau | 5 | ✅ |
| reconditionnes.html | reco-ecran | 5 | ✅ |
| reconditionnes.html | reco-smartphone | 5 | ✅ |
| protection.html | protection | 0 | ❌ vide |
| services.html | service | 0 | ❌ vide |
