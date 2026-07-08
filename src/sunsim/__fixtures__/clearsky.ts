// Reference values for the clear-sky radiation model, generated with
// pvlib-python v0.13.0 (BSD-3-Clause, https://github.com/pvlib/pvlib-python)
// on 2026-07-08. Cases are parameterized directly by apparent zenith so the
// solar-position model difference is factored out; dniExtra is passed
// explicitly to decouple the solar-constant choice.
//
// Generation script (python; pip install pvlib):
//   # skydial clear-sky fixture generator.
//   # Computes pvlib reference values for the Ineichen-Perez clear-sky model and
//   # the Hay-Davies transposition, parameterized directly by apparent zenith so
//   # the solar-position model difference is factored out.
//   import json
//   
//   import pvlib
//   from pvlib import atmosphere, clearsky, irradiance
//   
//   DNI_EXTRA = 1361.0  # passed explicitly to both sides
//   
//   ineichen_cases = []
//   for z in [5.0, 10.0, 30.0, 60.0, 75.0, 85.0]:
//       for tl in [2.0, 3.0, 5.0]:
//           for alt in [0.0, 1000.0]:
//               am_rel = atmosphere.get_relative_airmass(z, model="kastenyoung1989")
//               pressure = atmosphere.alt2pres(alt)
//               am_abs = atmosphere.get_absolute_airmass(am_rel, pressure)
//               out = clearsky.ineichen(
//                   apparent_zenith=z,
//                   airmass_absolute=am_abs,
//                   linke_turbidity=tl,
//                   altitude=alt,
//                   dni_extra=DNI_EXTRA,
//                   perez_enhancement=False,
//               )
//               ineichen_cases.append(
//                   {
//                       "zenith": z,
//                       "tl": tl,
//                       "altitudeM": alt,
//                       "amAbs": float(am_abs),
//                       "ghi": float(out["ghi"]),
//                       "dni": float(out["dni"]),
//                       "dhi": float(out["dhi"]),
//                   }
//               )
//   
//   haydavies_cases = []
//   for (tilt, saz, z, az, dni, dhi) in [
//       (90.0, 180.0, 30.0, 180.0, 800.0, 100.0),
//       (90.0, 180.0, 60.0, 150.0, 700.0, 120.0),
//       (90.0, 90.0, 60.0, 150.0, 700.0, 120.0),
//       (90.0, 0.0, 60.0, 180.0, 700.0, 120.0),
//       (30.0, 180.0, 45.0, 200.0, 850.0, 90.0),
//       (0.0, 0.0, 45.0, 200.0, 850.0, 90.0),
//       (90.0, 180.0, 88.0, 180.0, 50.0, 30.0),
//   ]:
//       sky = irradiance.haydavies(
//           surface_tilt=tilt,
//           surface_azimuth=saz,
//           dhi=dhi,
//           dni=dni,
//           dni_extra=DNI_EXTRA,
//           solar_zenith=z,
//           solar_azimuth=az,
//       )
//       cos_tt = irradiance.aoi_projection(tilt, saz, z, az)
//       haydavies_cases.append(
//           {
//               "tilt": tilt,
//               "surfaceAz": saz,
//               "zenith": z,
//               "solarAz": az,
//               "dni": dni,
//               "dhi": dhi,
//               "cosIncidence": float(cos_tt),
//               "skyDiffuse": float(sky),
//           }
//       )
//   
//   print(
//       json.dumps(
//           {
//               "pvlibVersion": pvlib.__version__,
//               "dniExtra": DNI_EXTRA,
//               "ineichen": ineichen_cases,
//               "haydavies": haydavies_cases,
//           },
//           indent=1,
//       )
//   )

export const PVLIB_VERSION = "0.13.0";
export const FIXTURE_DNI_EXTRA = 1361;

export interface IneichenCase {
  zenith: number;
  tl: number;
  altitudeM: number;
  amAbs: number;
  ghi: number;
  dni: number;
  dhi: number;
}

export const INEICHEN_CASES: IneichenCase[] = [
  {
    "zenith": 5,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 1.0035030980725235,
    "ghi": 1088.9048420195388,
    "dni": 1011.8826163087324,
    "dhi": 80.87274456157559
  },
  {
    "zenith": 5,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 0.890102064132447,
    "ghi": 1135.9641690412454,
    "dni": 1064.6594828094212,
    "dhi": 75.35603699340004
  },
  {
    "zenith": 5,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 1.0035030980725235,
    "ghi": 1047.427218413277,
    "dni": 939.5432576299964,
    "dhi": 111.4592065344275
  },
  {
    "zenith": 5,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 0.890102064132447,
    "ghi": 1101.1177271844144,
    "dni": 984.0836336951116,
    "dhi": 120.77882881848473
  },
  {
    "zenith": 5,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 1.0035030980725235,
    "ghi": 969.1515794162109,
    "dni": 784.2778071088865,
    "dhi": 187.85818614331754
  },
  {
    "zenith": 5,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 0.890102064132447,
    "ghi": 1034.5988651220152,
    "dni": 838.3976540950872,
    "dhi": 199.39156721993209
  },
  {
    "zenith": 10,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 1.0150711468885742,
    "ghi": 1075.4947853290732,
    "dni": 1010.9770155111357,
    "dhi": 79.87678233656345
  },
  {
    "zenith": 10,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 0.9003628636745004,
    "ghi": 1121.784765266154,
    "dni": 1063.5267025048597,
    "dhi": 74.41542310386012
  },
  {
    "zenith": 10,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 1.0150711468885742,
    "ghi": 1034.0649285958334,
    "dni": 937.5889302256245,
    "dhi": 110.72008097121625
  },
  {
    "zenith": 10,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 0.9003628636745004,
    "ghi": 1086.9828193982705,
    "dni": 982.2677638345672,
    "dhi": 119.63791004002417
  },
  {
    "zenith": 10,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 1.0150711468885742,
    "ghi": 955.9315785548184,
    "dni": 781.0184755337901,
    "dhi": 186.77852860336645
  },
  {
    "zenith": 10,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 0.9003628636745004,
    "ghi": 1020.5844901216774,
    "dni": 835.3064200504729,
    "dhi": 197.9682515150996
  },
  {
    "zenith": 30,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 1.1539922191032224,
    "ghi": 935.6592905092592,
    "dni": 1000.164727946298,
    "dhi": 69.49122813861322
  },
  {
    "zenith": 30,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 1.0235851370957374,
    "ghi": 973.9498513559267,
    "dni": 1050.0168869783695,
    "dhi": 64.60855283000501
  },
  {
    "zenith": 30,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 1.1539922191032224,
    "ghi": 894.7925515815185,
    "dni": 914.4344797240543,
    "dhi": 102.86906204408126
  },
  {
    "zenith": 30,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 1.0235851370957374,
    "ghi": 939.6726261957268,
    "dni": 960.7208939957945,
    "dhi": 107.66392604887187
  },
  {
    "zenith": 30,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 1.1539922191032224,
    "ghi": 818.3359161175437,
    "dni": 742.9191474973518,
    "dhi": 174.94906142695856
  },
  {
    "zenith": 30,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 1.0235851370957374,
    "ghi": 874.6947810016021,
    "dni": 799.0620555111923,
    "dhi": 182.68674172869828
  },
  {
    "zenith": 60,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 1.9942928278847851,
    "ghi": 506.18691225704663,
    "dni": 937.1850232971685,
    "dhi": 37.59440060846225
  },
  {
    "zenith": 60,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 1.7689274362922724,
    "ghi": 520.4662150495451,
    "dni": 971.880478595742,
    "dhi": 34.52597575167397
  },
  {
    "zenith": 60,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 1.9942928278847851,
    "ghi": 468.5893790101852,
    "dni": 786.0746084949787,
    "dhi": 75.55207476269572
  },
  {
    "zenith": 60,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 1.7689274362922724,
    "ghi": 489.21775367557865,
    "dni": 840.1011657853379,
    "dhi": 69.16717078290958
  },
  {
    "zenith": 60,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 1.9942928278847851,
    "ghi": 401.5646716761065,
    "dni": 548.9893270743327,
    "dhi": 127.07000813894012
  },
  {
    "zenith": 60,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 1.7689274362922724,
    "ghi": 432.23660219621553,
    "dni": 611.0112561534971,
    "dhi": 126.73097411946691
  },
  {
    "zenith": 75,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 3.812911822102736,
    "ghi": 227.61735107009812,
    "dni": 798.6017250374813,
    "dhi": 20.924015178671397
  },
  {
    "zenith": 75,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 3.3820330896112267,
    "ghi": 227.89558221407498,
    "dni": 822.1101224168369,
    "dhi": 15.1178253610328
  },
  {
    "zenith": 75,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 3.812911822102736,
    "ghi": 196.39074012343883,
    "dni": 566.6264627179856,
    "dhi": 49.73702011295072
  },
  {
    "zenith": 75,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 3.3820330896112267,
    "ghi": 202.45288093263292,
    "dni": 628.3914513456762,
    "dhi": 39.81320554475789
  },
  {
    "zenith": 75,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 3.812911822102736,
    "ghi": 146.2016556388136,
    "dni": 285.2529021465091,
    "dhi": 72.37277189253133
  },
  {
    "zenith": 75,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 3.3820330896112267,
    "ghi": 159.77177896904982,
    "dni": 341.858649583457,
    "dhi": 71.29224972382222
  },
  {
    "zenith": 85,
    "tl": 2,
    "altitudeM": 0,
    "amAbs": 10.305791200576538,
    "ghi": 46.371478614320004,
    "dni": 445.19091411264947,
    "dhi": 7.570533830323157
  },
  {
    "zenith": 85,
    "tl": 2,
    "altitudeM": 1000,
    "amAbs": 9.141183557649798,
    "ghi": 42.22226171432954,
    "dni": 452.30959929860967,
    "dhi": 2.800882635563582
  },
  {
    "zenith": 85,
    "tl": 3,
    "altitudeM": 0,
    "amAbs": 10.305791200576538,
    "ghi": 31.119992731215323,
    "dni": 176.0876711576295,
    "dhi": 15.772940962766745
  },
  {
    "zenith": 85,
    "tl": 3,
    "altitudeM": 1000,
    "amAbs": 9.141183557649798,
    "ghi": 30.660686519111245,
    "dni": 222.85385952965197,
    "dhi": 11.237692867622155
  },
  {
    "zenith": 85,
    "tl": 5,
    "altitudeM": 0,
    "amAbs": 10.305791200576538,
    "ghi": 14.015757421843345,
    "dni": 27.548265806507825,
    "dhi": 11.614767854067242
  },
  {
    "zenith": 85,
    "tl": 5,
    "altitudeM": 1000,
    "amAbs": 9.141183557649798,
    "ghi": 16.168235926998726,
    "dni": 42.99583187359412,
    "dhi": 12.420902265002196
  }
];

export interface HayDaviesCase {
  tilt: number;
  surfaceAz: number;
  zenith: number;
  solarAz: number;
  dni: number;
  dhi: number;
  cosIncidence: number;
  skyDiffuse: number;
}

export const HAYDAVIES_CASES: HayDaviesCase[] = [
  {
    "tilt": 90,
    "surfaceAz": 180,
    "zenith": 30,
    "solarAz": 180,
    "dni": 800,
    "dhi": 100,
    "cosIncidence": 0.5,
    "skyDiffuse": 54.54667269299784
  },
  {
    "tilt": 90,
    "surfaceAz": 180,
    "zenith": 60,
    "solarAz": 150,
    "dni": 700,
    "dhi": 120,
    "cosIncidence": 0.75,
    "skyDiffuse": 121.71932402645112
  },
  {
    "tilt": 90,
    "surfaceAz": 90,
    "zenith": 60,
    "solarAz": 150,
    "dni": 700,
    "dhi": 120,
    "cosIncidence": 0.43301270189221946,
    "skyDiffuse": 82.59084049808439
  },
  {
    "tilt": 90,
    "surfaceAz": 0,
    "zenith": 60,
    "solarAz": 180,
    "dni": 700,
    "dhi": 120,
    "cosIncidence": -0.8660254037844386,
    "skyDiffuse": 29.14033798677443
  },
  {
    "tilt": 30,
    "surfaceAz": 180,
    "zenith": 45,
    "solarAz": 200,
    "dni": 850,
    "dhi": 90,
    "cosIncidence": 0.9446039478901318,
    "skyDiffuse": 106.61531248684327
  },
  {
    "tilt": 0,
    "surfaceAz": 0,
    "zenith": 45,
    "solarAz": 200,
    "dni": 850,
    "dhi": 90,
    "cosIncidence": 0.7071067811865476,
    "skyDiffuse": 90
  },
  {
    "tilt": 90,
    "surfaceAz": 180,
    "zenith": 88,
    "solarAz": 180,
    "dni": 50,
    "dhi": 30,
    "cosIncidence": 0.9993908270190958,
    "skyDiffuse": 46.00983095104576
  }
];
