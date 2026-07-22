# CSV vs MySQL User/Branch Comparison (Full Dataset)

Source CSV: `userBranchesAndWorkTypes.csv`

MySQL users compared: **84**
MySQL branches compared: **33**

Matching rules:
- Users matched by **email** (case-insensitive)
- Branches matched by CSV **`branch_alias`** → MySQL **`branches.alias`**
- CSV **`BitDenver`** / **`BitDrywall Head Office`** → MySQL branch **`id = '2'`** (Denver)

## Summary

| Metric | Count |
|--------|------:|
| CSV users | 122 |
| CSV users missing from MySQL | 96 |
| CSV users matched in MySQL | 26 |
| Matched users already on correct branch | 8 |
| Matched users needing branch update | 18 |
| Matched users with unresolved CSV branch | 0 |
| CSV unique branches | 29 |
| CSV branches found in MySQL | 29 |
| CSV branches missing from MySQL | 0 |

Generated SQL file: `update-user-branches-from-csv.sql`

---

## 1. CSV users not found in MySQL

| # | Name | Email | CSV branch alias |
|---|------|-------|------------------|
| 1 | Thabo Gabosimologe | `thabog@gmail.com` | `BitGaborone` |
| 2 | Tshenolo Galetswegope | `sales30@bitgroup.co.za` | `BitGaborone` |
| 3 | Tumiso Maswabi | `tumiso@gmail.com` | `BitGaborone` |
| 4 | Hugo Amaro Azeredo | `hugo.azeredo@bitgroup.co.za` | `BitDenver` |
| 5 | Sandra Benedicta Bell | `sales21@legendsystems.co.za` | `BitDenver` |
| 6 | Lindelani Zweli Buthelezi | `lindelanizweli543@gmail.com` | `BitDenver` |
| 7 | Gary Calaca | `garycalaca@ymail.com` | `BitDenver` |
| 8 | Jackie Campher | `jackiecampher61@gmail.com` | `BitDenver` |
| 9 | Julian Diviani | `julian@bitgroup.co.za` | `BitDenver` |
| 10 | Simphiwe Dladla | `sdladla0216@gmail.com` | `BitDenver` |
| 11 | Ntobeko Khanyile | `nn@gmail.com` | `BitDenver` |
| 12 | Diane Kinnear | `kinneard65@gmail.com` | `BitDenver` |
| 13 | Chilton Warrick Lau | `chilton.lau@bitgroup.co.za` | `BitDenver` |
| 14 | Siviwe Madikane | `siviwe.madikane@bitgroup.co.za` | `BitDenver` |
| 15 | Khulumani Mazibuko | `khulumani@gmail.com` | `BitDenver` |
| 16 | Sihle Mbatha | `sihlemba301@gmail.com` | `BitDenver` |
| 17 | Tanica Meinie | `meinietanica@gmail.com` | `BitDenver` |
| 18 | Bongumusa Miya | `bongumusajunior@gmail.com` | `BitDenver` |
| 19 | Sibonakaliso Mkhize | `sm@gmail.com` | `BitDenver` |
| 20 | Thokozani Mkhize | `thokozanimkhize98@gmail.com` | `BitDenver` |
| 21 | Margarida Morehen | `marg@gmail.com` | `BitDenver` |
| 22 | Alois Morongoa | `atmorongoa@gmail.com` | `BitDenver` |
| 23 | karabo Motlhoana | `mgababamomothoana@gmail.com` | `BitDenver` |
| 24 | Innocent Mkhawuleni Mthembu | `innocentmthembu744@gmail.com` | `BitDenver` |
| 25 | Sboniso Mthethwa | `snnnm@gmail.com` | `BitDenver` |
| 26 | Bonita Munthri | `bmunthri@gmail.com` | `BitDenver` |
| 27 | Avela Ncontsa | `avelancontsa05@gmail.com` | `BitDenver` |
| 28 | Felex Hloniphani Ndlovu | `fht.quality@gmail.com` | `BitDenver` |
| 29 | Josiphat Ndlovu | `josiphat@gmail.com` | `BitDenver` |
| 30 | Mthobisi Ngubane | `mngubane@gmail.com` | `BitDenver` |
| 31 | Patrick Ngubane | `patngubane549@gmail.com` | `BitDenver` |
| 32 | Jabu Ngwenya | `jabungwenya@gmail.com` | `BitDenver` |
| 33 | Ian sakhile Nkosi | `sakhileian89@gmail.com` | `BitDenver` |
| 34 | Sandile Ntuli | `sandintuli@gmail.com` | `BitDenver` |
| 35 | Sanet Oelofse | `sanet@fusechem.co.za` | `BitDenver` |
| 36 | Brandon Olifant | `brandonolifant10@gmail.com` | `BitDenver` |
| 37 | Valdimira Pereira | `valdip503@gmail.com` | `BitDenver` |
| 38 | Beatrice Salome Ramoshaba | `mdlalosebeatrice@gmail.com` | `BitDenver` |
| 39 | Bongiwe Shezi | `shezib399@gmail.com` | `BitDenver` |
| 40 | Nompumelelo Natasha Shiba | `natashashiba7@gmail.com` | `BitDenver` |
| 41 | Mthobisi Shoba | `shobamthobisi085@gmail.com` | `BitDenver` |
| 42 | Ruben Tavares | `ruben@bitgroup.co.za` | `BitDenver` |
| 43 | Patrick Moses Vilakazi | `patrick@gmail.com` | `BitDenver` |
| 44 | Vusumuzi Brian Vundla | `vundlavusumuzi46@gmail.com` | `BitDenver` |
| 45 | Siyabonga Zulu | `siyabongavezuthando@gmail.com` | `BitDenver` |
| 46 | Benedict Zwane | `ben@bitgroup.co.za` | `BitDenver` |
| 47 | Wardson Tapiwa Chikuruwo | `wtc@gmail.com` | `BitHarare` |
| 48 | Takunda Shavi | `shavitakunda@gmail.com` | `BitHarare` |
| 49 | Zibusiso sibanda | `ziedawu@gmail.com` | `BitHarare` |
| 50 | Lorenzo Thabang Maskew | `lorenzomaskew@gmail.com` | `BitWitbank` |
| 51 | Joseph Chingembo | `josephchingembo@gmail.com` | `BitLusaka` |
| 52 | Elias Kunda | `eliaskunda@gmail.com` | `BitLusaka` |
| 53 | Kenneth Mukumba | `kenneth.mukumba@bitgroup.co.za` | `BitLusaka` |
| 54 | Faison Million | `faisonmillion@icloud.com` | `BitBoksburg` |
| 55 | Nkululeko Lewele Ndlovu | `nkululeko@bitgroup.co.za` | `BitBronkhortspruit` |
| 56 | Mogau Baloi | `mo@gmail.com` | `BitBurgersfort` |
| 57 | Chedza Batsho James James | `chedzabatsho@gmail.com` | `BitFrancistown` |
| 58 | Oratile Kgakgamatso | `oratilekakgamatso@gmail.com` | `BitFrancistown` |
| 59 | Kheu Mokganedi | `kheu@gmail.com` | `BitFrancistown` |
| 60 | Jeandre Bouwer | `jeandreb12345@icloud.com` | `BitGeorge` |
| 61 | Edwina Heloise Cornelius | `edwinahc83@gmail.com` | `BitGeorge` |
| 62 | Anathi Malikiti | `anathi@gmail.com` | `BitGeorge` |
| 63 | Ephraim Ngqukudu | `ephraim@gmail.com` | `BitGeorge` |
| 64 | Fernando Moises Guambe | `fernando@gmail.com` | `GIPTEC Maputo` |
| 65 | Eugenio Marcos Miambo | `eugenio.miambo@bitgroup.co.za` | `GIPTEC Maputo` |
| 66 | Rafael Paulo Uaiene | `rafael.uaiene@bitgroup.co.za` | `GIPTEC Matola` |
| 67 | Gilberto Sara Zandamela | `gilberto@gmail.com` | `GIPTEC Matola` |
| 68 | Sergio Dimande | `sergio@bitgroup.co.za` | `GIPTEC Xai Xai` |
| 69 | Jaime Alberto Mabjaia | `jaime@gmail.com` | `GIPTEC Zimpeto` |
| 70 | Vieira Sergio Manhique | `vieira@gmail.com` | `GIPTEC Zimpeto` |
| 71 | Ernesto Armindo Nhanombe | `ernesto@gmail.com` | `GIPTEC Zimpeto` |
| 72 | Paulo Maximiano Sitoe | `paulo@gmail.com` | `GIPTEC Zimpeto` |
| 73 | Thiambi Edcan Mushadu | `nduvhonemutudi@gmail.com` | `BitGiyani` |
| 74 | Mpho Magadagela | `magadagelaml@gmail.com` | `BitLouisTrichardt` |
| 75 | Lavhelesani Dakalo Rathogwa | `lavhelesanidakalo@gmail.com` | `BitLouisTrichardt` |
| 76 | Thoriso Mashishi | `thoriso@legendsystems.co.za` | `BitMafikeng` |
| 77 | Boitshwaro Mosalashuping | `mosalaking6@gmail.com` | `BitMafikeng` |
| 78 | Penny Patel | `penny@gmail.com` | `BitMidrand` |
| 79 | Kgaugelo Jene | `kgaugelo@gmail.com` | `BitMokopane` |
| 80 | Melvin Mabatha | `mabathamelvin@gmail.com` | `Bitnelspruit` |
| 81 | Frans Ndhlovu | `fransndhlovu27@gmail.com` | `Bitnelspruit` |
| 82 | Nditsheni Stiga Raphasha | `stiga.raphasha@bitgroup.co.za` | `Bitnelspruit` |
| 83 | Christopher Mafunisa | `mafunisac1@gmail.com` | `BitPolokwane` |
| 84 | Johannes Mereyathaba Malatjii | `jm@gmail.com` | `BitPolokwane` |
| 85 | Johannes Mphoka | `JOHANNESBITDRYWALL@GMAIL.COM` | `BitPolokwane` |
| 86 | Malekutu Agreement Rallele | `rallelema@gmail.com` | `BitPolokwane` |
| 87 | Nathan Coetzee | `nathan.coetzee@bitgroup.co.za` | `BitPE` |
| 88 | Mthobeli Maxwell Nyiki | `maxnyiki@gmail.com` | `BitPE` |
| 89 | Ashley Stone | `ashley.stone020972@gmail.com` | `BitPE` |
| 90 | Calvin Lindeque | `calvinlindeque4@gmail.com` | `BitRandfontein` |
| 91 | Bennet van louwe | `vanlouwebennet@gmail.com` | `BitRandfontein` |
| 92 | Katlego Success Ngolobe | `ksn@gmail.com` | `BitRustenburg` |
| 93 | Lindokuhle Charity Masina | `masinalindy1@gmail.com` | `BitSouthGate` |
| 94 | Thabiso Mazibuko | `thabisomazibuko718@gmail.com` | `BitSouthGate` |
| 95 | Ipfi Bale | `israelbalexxx@gmail.com` | `BitThohoyandou` |
| 96 | Tshepo Madou | `matlou7188@gmail.com` | `BitTzaneen` |

---

## 2. Branch update SQL

**18** users need `branchIdId` updated. **8** matched users are already correct.

Run the generated script after review:

```sql
-- See scripts/update-user-branches-from-csv.sql
```

### Users requiring branch changes

| Email | Current branch | Target branch id | CSV alias | Target branch |
|-------|----------------|------------------|-----------|---------------|
| `prudencelencwe76@gmail.com` | `2` | `28f70e60-604b-4c51-8760-357800bcccdf` | `BitBethlehem` | BitBethlehem |
| `mofokengfanyane74@gmail.com` | `2` | `28f70e60-604b-4c51-8760-357800bcccdf` | `BitBethlehem` | BitBethlehem |
| `bethlehem@bitgroup.co.za` | `2` | `28f70e60-604b-4c51-8760-357800bcccdf` | `BitBethlehem` | BitBethlehem |
| `tjaart.pretorius@bitgroup.co.za` | `None` | `2` | `BitDenver` | Denver - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `mosesvilakazi17@gmail.com` | `2` | `54391e47-c7ef-47d0-8f4d-8e45f20bf3d0` | `BitBoksburg` | BitBoksburg |
| `stuurmantumi41@gmail.com` | `None` | `30c19866-7ef5-4dcc-89f3-33f265146d31` | `BitBronkhortspruit` | BitBronkhortspruit |
| `burgersfort1@bitgroup.co.za` | `2` | `06889faa-fc18-41f3-a186-6396fa7defca` | `BitBurgersfort` | BitBurgersfort |
| `nelson.matsinhe@bitgroup.co.za` | `2` | `fd80a488-e831-4229-8cfe-5c344494c606` | `GIPTEC Matola` | GIPTEC Matola |
| `giyani@bitgroup.co.za` | `2` | `fedb3796-a73f-4549-bf01-36fea1cfaa53` | `BitGiyani` | BitGiyani |
| `Midrand2@bitgroup.co.za` | `2` | `3d106cc4-eee7-48eb-a625-a9338afb9879` | `BitMidrand` | BitMidrand |
| `mokopane2@bitgroup.co.za` | `2` | `48ce30a1-7991-4b0b-b538-569c128a9d6e` | `BitMokopane` | BitMokopane |
| `inocent.livhalani@bitgroup.co.za` | `2` | `b29610c2-0a79-4c3f-945e-31f6f1ee022e` | `BitPolokwane` | BitPolokwane |
| `soweto@bitgroup.co.za` | `2` | `f303a941-0723-4f55-96f1-47dd52c26494` | `BitRobertsville` | BitRobertsville |
| `Patrick@bitgroup.co.za` | `2` | `9299084b-1777-4214-9af3-3d5158e91e7e` | `BitRustenburg` | BitRustenburg |
| `Rustenburg@bitgroup.co.za` | `2` | `9299084b-1777-4214-9af3-3d5158e91e7e` | `BitRustenburg` | BitRustenburg |
| `Southgate@bitgroup.co.za` | `2` | `5de01bbf-d469-4b7b-b325-02cf2b986004` | `BitSouthGate` | BitSouthGate |
| `Thohoyando@bitgroup.co.za` | `2` | `ff87c43a-42f9-4781-b472-204ba80a6bfd` | `BitThohoyandou` | BitThohoyandou |
| `tzaneen@bitgroup.co.za` | `2` | `016e4cd7-8ff0-4d83-83db-3594490e4919` | `BitTzaneen` | BitTzaneen |

---

## 3. CSV branches not found in MySQL

_None — every CSV branch alias maps to a MySQL branch._

### CSV branches successfully mapped

| CSV alias | MySQL id | MySQL alias | MySQL name |
|-----------|----------|-------------|------------|
| `BitBethlehem` | `28f70e60-604b-4c51-8760-357800bcccdf` | `BitBethlehem` | BETHLEHEM - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitBoksburg` | `54391e47-c7ef-47d0-8f4d-8e45f20bf3d0` | `BitBoksburg` | BOKSBURG - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitBronkhortspruit` | `30c19866-7ef5-4dcc-89f3-33f265146d31` | `BitBronkhortspruit` | BRONKHORSTSPRUIT - BRADERIENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitBurgersfort` | `06889faa-fc18-41f3-a186-6396fa7defca` | `BitBurgersfort` | BURGERSFORT - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitDenver` | `2` | `None` | Denver - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitFrancistown` | `a737ebc9-2d08-47c6-892a-ffa2c2989ea0` | `BitFrancistown` | Francistown |
| `BitGaborone` | `269ee44d-2767-474c-a48c-383bff7d0427` | `BitGaborone` | BIT BOTSWANA PTY LTD T/A BIT GROUP BOTSWANA GABARONE |
| `BitGeorge` | `e951e09e-4516-4a3c-a04b-a03ef3d9023e` | `BitGeorge` | GEORGE - BRADERIENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitGiyani` | `fedb3796-a73f-4549-bf01-36fea1cfaa53` | `BitGiyani` | GIYANI - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitHarare` | `a2ad8f4a-9ed2-4048-b531-89da6883f9e0` | `BitHarare` | BITGROUP ZIMBABWE (PRIVATE) LIMITED |
| `BitLouisTrichardt` | `193867ca-53a2-476c-81ef-44ffb68ab0f1` | `BitLouisTrichardt` | LOUIS TRICHARDT - BRADERIENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitLusaka` | `87d7fd91-9550-4ec7-873b-2139c5f95f31` | `BitLusaka` | BIT ZAM IMPORTS LIMITED |
| `BitMafikeng` | `b12e38da-4e84-4cc7-bcb8-9b36695aeb04` | `BitMafikeng` | MAFIKENG - BRADERIENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitMidrand` | `3d106cc4-eee7-48eb-a625-a9338afb9879` | `BitMidrand` | MIDRAND - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitMokopane` | `48ce30a1-7991-4b0b-b538-569c128a9d6e` | `BitMokopane` | MOKOPANE - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `Bitnelspruit` | `1363d96e-86e1-467a-ad6b-3b0cda255223` | `Bitnelspruit` | NELSPRUIT - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitPE` | `95d71f0e-d267-4aab-87ca-6307df887e4c` | `BitPE` | PORT ELIZABETH - BRADERIENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitPolokwane` | `b29610c2-0a79-4c3f-945e-31f6f1ee022e` | `BitPolokwane` | POLOKWANE - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitRandfontein` | `b298e2b0-c8f6-427d-88a3-a047aea7da4c` | `BitRandfontein` | RANDFONTEIN - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitRobertsville` | `f303a941-0723-4f55-96f1-47dd52c26494` | `BitRobertsville` | ROBERTSVILLE - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitRustenburg` | `9299084b-1777-4214-9af3-3d5158e91e7e` | `BitRustenburg` | RUSTENBURG - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitSouthGate` | `5de01bbf-d469-4b7b-b325-02cf2b986004` | `BitSouthGate` | SOUTHGATE - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitThohoyandou` | `ff87c43a-42f9-4781-b472-204ba80a6bfd` | `BitThohoyandou` | THOHOYANDOU - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitTzaneen` | `016e4cd7-8ff0-4d83-83db-3594490e4919` | `BitTzaneen` | TZANEEN - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD |
| `BitWitbank` | `68b3ac03-6906-4466-97fa-9c9c92ff0957` | `BitWitbank` | BitWitbank |
| `GIPTEC Maputo` | `66395da2-3cc9-4e4d-8e02-53707d54702d` | `GIPTEC Maputo` | GIPTEC MOZAMBIQUE MAPUTO |
| `GIPTEC Matola` | `fd80a488-e831-4229-8cfe-5c344494c606` | `GIPTEC Matola` | GIPTEC MOZAMBIQUE MATOLA |
| `GIPTEC Xai Xai` | `ff76f348-5685-4dc8-8061-68a6e06552f5` | `GIPTEC Xai Xai` | GIPTEC MOZAMBIQUE XAI XAI |
| `GIPTEC Zimpeto` | `5d0aaf7c-325b-406c-8b5b-b6403a406b0f` | `GIPTEC Zimpeto` | GIPTEC MOZAMBIQUE ZIMPETO |

---

## Notes

1. Several CSV people may exist in MySQL under **different emails** (branch mailbox accounts vs personal emails). Those appear under section 1 as missing unless emails align exactly.
2. MySQL branch **`BitLanseria`** exists but has **no users** in the CSV.
3. MySQL branch **`BitEmalahleni`** exists separately from **`BitWitbank`**; CSV uses **`BitWitbank`** for Witbank users.
4. **`richardsbay@bitgroup.co.za`** in CSV maps to Denver head office; MySQL branch account **`RichardsBay@bitgroup.co.za`** may need a separate decision if that mailbox should stay on **`BitRichards Bay`** (`678729c8-...`).
