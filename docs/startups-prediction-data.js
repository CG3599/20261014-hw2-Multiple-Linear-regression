/* 50 Startups, best training-CV model: Backward (R&D Spend only).
 * Reproduces sklearn train_test_split(random_state=42), fits 40-row OLS,
 * then uses Student-t 95% individual prediction intervals with leverage.
 * Assumptions: independent, homoscedastic, normal OLS errors. */
const STARTUPS_PREDICTION = {
  "method": "Backward",
  "features": [
    "R&D Spend"
  ],
  "trainCount": 40,
  "testCount": 10,
  "df": 38,
  "tCritical": 2.024394163911969,
  "intervalType": "OLS t-distribution 95% prediction interval",
  "points": [
    {
      "actual": 134307.35,
      "predicted": 127862.2099640519,
      "lower": 107713.90131541148,
      "upper": 148010.51861269234
    },
    {
      "actual": 81005.76,
      "predicted": 82250.56334619469,
      "lower": 61957.387422078966,
      "upper": 102543.73927031041
    },
    {
      "actual": 99937.59,
      "predicted": 102255.72078164021,
      "lower": 82102.84635755896,
      "upper": 122408.59520572146
    },
    {
      "actual": 64926.08,
      "predicted": 50190.473475600724,
      "lower": 29429.33181529357,
      "upper": 70951.61513590788
    },
    {
      "actual": 125370.37,
      "predicted": 130136.88190548433,
      "lower": 109979.44118594137,
      "upper": 150294.3226250273
    },
    {
      "actual": 35673.41,
      "predicted": 49799.366854719556,
      "lower": 29030.729320955918,
      "upper": 70568.0043884832
    },
    {
      "actual": 105733.54,
      "predicted": 113638.07752879555,
      "lower": 93511.59795819163,
      "upper": 133764.55709939945
    },
    {
      "actual": 107404.34,
      "predicted": 104535.05342879966,
      "lower": 84390.58325222271,
      "upper": 124679.5236053766
    },
    {
      "actual": 97427.84,
      "predicted": 103463.0484311271,
      "lower": 83314.8198556642,
      "upper": 123611.27700659
    },
    {
      "actual": 122776.86,
      "predicted": 123105.3110266948,
      "lower": 102971.07767865546,
      "upper": 143239.54437473413
    }
  ]
};
