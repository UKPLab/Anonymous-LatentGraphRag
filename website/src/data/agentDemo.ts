/**
 * The ReAct demo's three examples, copied from the released runs behind Table 5 (one run per condition).
 * Where the values come from:
 *   - question, gold answer, seed (top ten of the documents + triples + propositions ranking), the agent's
 *     SEARCH queries with the five documents each returned, the "Exact Answer" line and the grade:
 *     public/data/traces/<ds>/t5__rdr_lgrp3d1_seed (MuSiQue) or t5__rdr_lgrp3_seed (FanOutQA), index.json
 *     and the s*.json shards;
 *   - notInDocSeed: whether the passage is missing from the same question's seed in t5__rdr_doc_seed;
 *   - runs: searches and outcome of the same question in t5__no_seed, t5__rdr_doc_seed and the run above
 *     (index.json: t, c, l);
 *   - titles and snippets: public/data/corpus/<ds>; gold flags: public/data/gold/<ds>.json;
 *   - memories: one triple and one proposition per gold seed passage, picked by hand from the memory maps
 *     behind the paper's memory index (MuSiQue: HippoRAG 2 release triples, PropRAG release propositions;
 *     FanOutQA: the paper's construction). They show what the memory index holds for the passage; which
 *     memories the memory tree visited for the question is not logged;
 *   - key, kind, title, blurb and chain are written by hand; chain summarises the gold evidence and is not
 *     model output.
 * Values were copied from these files; when a run file changes, update the matching values here.
 */

export type DemoMemory = { triple: string; proposition: string };
export type DemoDoc = {
  id: string;
  title: string;
  snippet: string;
  gold: boolean;
  /** seed passages only: absent from the same question's documents-only seed */
  notInDocSeed?: boolean;
  memories?: DemoMemory;
};
export type DemoSearch = { query: string; results: DemoDoc[] };
export type DemoRun = {
  runId: string;
  label: string;
  searches: number;
  correct: boolean | null;
  listRecall: number | null;
};
export type DemoSlide = {
  key: string;
  kind: string;
  title: string;
  blurb: string;
  chain: string[];
  dataset: "MuSiQue" | "FanOutQA";
  ds: "musique" | "fanoutqa";
  qid: string;
  runId: string;
  question: string;
  goldAnswer: string;
  answer: string;
  grade: { kind: "verdict"; correct: boolean } | { kind: "list"; recall: number };
  seed: DemoDoc[];
  searches: DemoSearch[];
  runs: DemoRun[];
};

export const agentDemo: DemoSlide[] = [
  {
    "key": "chain",
    "kind": "Multi-hop chain",
    "title": "Answered from the seed",
    "blurb": "The documents-only seed misses the passage that links the state to its ocean (Virginia). The fused seed adds it at rank 5, so all four gold passages are in the seed and the agent answers in its first turn without searching.",
    "chain": [
      "Main Street Station in Richmond shares its track with trains to Williamsburg and Newport News",
      "Richmond and Newport News lie in Virginia",
      "Virginia is bordered by the Atlantic Ocean",
      "Atlantic hurricanes form usually in the summer or fall"
    ],
    "dataset": "MuSiQue",
    "ds": "musique",
    "qid": "4hop1__39871_314549_131976_56103",
    "runId": "t5__rdr_lgrp3d1_seed",
    "question": "When do hurricanes occur in the ocean that borders the state where Williamsburg, Main Street Station and another share a track?",
    "goldAnswer": "usually in the summer or fall",
    "answer": "Usually in the summer or fall (officially from June 1 to November 30)",
    "grade": {
      "kind": "verdict",
      "correct": true
    },
    "seed": [
      {
        "id": "musique_008329",
        "title": "Atlantic hurricane",
        "snippet": "An Atlantic hurricane or tropical storm is a tropical cyclone that forms in the Atlantic Ocean, usually in the summer or fall. A hurricane …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Atlantic hurricane forms in Atlantic Ocean.",
          "proposition": "An Atlantic hurricane or tropical storm is a tropical cyclone that forms in the Atlantic Ocean, usually in the summer or fall."
        }
      },
      {
        "id": "musique_002053",
        "title": "Richmond, Virginia",
        "snippet": "The Richmond area also has two railroad stations served by Amtrak. Each station receives regular service from north of Richmond including …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "As of 2010 the station receives trains to and from Williamsburg.",
          "proposition": "As of 2010, the Main Street Station in Richmond, Virginia, only receives trains headed to and from Newport News and Williamsburg due to track layout."
        }
      },
      {
        "id": "musique_010439",
        "title": "2016 Atlantic hurricane season",
        "snippet": "The 2016 Atlantic hurricane season was the first above - average and costliest hurricane season since 2012. The season officially started …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_007381",
        "title": "East Coast of the United States",
        "snippet": "The East Coast of the United States is the coastline along which the Eastern United States meets the North Atlantic Ocean. This area is …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_002045",
        "title": "Virginia",
        "snippet": "Virginia has a total area of , including of water, making it the 35th-largest state by area. Virginia is bordered by Maryland and …",
        "gold": true,
        "notInDocSeed": true,
        "memories": {
          "triple": "Virginia is bordered by Atlantic Ocean.",
          "proposition": "Virginia is bordered by the Atlantic Ocean to the east."
        }
      },
      {
        "id": "musique_008331",
        "title": "Typhoon",
        "snippet": "A typhoon differs from a cyclone or hurricane only on the basis of location. A hurricane is a storm that occurs in the Atlantic Ocean and …",
        "gold": false,
        "notInDocSeed": true
      },
      {
        "id": "musique_002043",
        "title": "Metropolitan Avenue/Lorimer Street station",
        "snippet": "Metropolitan Avenue/Lorimer Street is an underground New York City Subway station complex shared by the BMT Canarsie Line and the IND …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_007394",
        "title": "Wassaw Sound",
        "snippet": "Wassaw Sound is a bay of the Atlantic Ocean on the coast of Georgia, United States near Savannah at the mouth of the Wilmington River.",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_002185",
        "title": "Geography of the United States",
        "snippet": "In central portions of the U.S., tornadoes are more common than anywhere else on Earth and touch down most commonly in the spring and …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_002050",
        "title": "Newport News, Virginia",
        "snippet": "Newport News is included in the Hampton Roads metropolitan area. It is at the southeastern end of the Virginia Peninsula, on the northern …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Newport News is located at southeastern end of the Virginia Peninsula.",
          "proposition": "Newport News is situated at the southeastern end of the Virginia Peninsula, on the northern shore of the James River."
        }
      }
    ],
    "searches": [],
    "runs": [
      {
        "runId": "t5__no_seed",
        "label": "No seed",
        "searches": 3,
        "correct": false,
        "listRecall": null
      },
      {
        "runId": "t5__rdr_doc_seed",
        "label": "documents only",
        "searches": 1,
        "correct": true,
        "listRecall": null
      },
      {
        "runId": "t5__rdr_lgrp3d1_seed",
        "label": "documents + triples + propositions",
        "searches": 0,
        "correct": true,
        "listRecall": null
      }
    ]
  },
  {
    "key": "gap",
    "kind": "A missing hop",
    "title": "Seed, then one search",
    "blurb": "The seed holds three of the four passages of the chain. The agent searches once, finds the last one and answers.",
    "chain": [
      "Erik Jensen was born in Appleton, Wisconsin",
      "Appleton lies in Outagamie County",
      "Brown County borders Outagamie County",
      "Green Bay is in Brown County"
    ],
    "dataset": "MuSiQue",
    "ds": "musique",
    "qid": "4hop1__707078_765799_282674_759393",
    "runId": "t5__rdr_lgrp3d1_seed",
    "question": "What is the capital of the county that shares a border with the county whose capital is the birthplace of Erik Jensen?",
    "goldAnswer": "Green Bay",
    "answer": "Green Bay",
    "grade": {
      "kind": "verdict",
      "correct": true
    },
    "seed": [
      {
        "id": "musique_008960",
        "title": "Erik Jensen (American football)",
        "snippet": "Erik Jensen (born October 11, 1980 in Appleton, Wisconsin) is a former American football tight end of the National Football League. He was …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Erik Jensen was born in Appleton.",
          "proposition": "Erik Jensen was born on October 11, 1980, in Appleton, Wisconsin."
        }
      },
      {
        "id": "musique_003116",
        "title": "Bruemmerville, Wisconsin",
        "snippet": "Bruemmerville is an unincorporated community located in the town of Ahnapee, Kewaunee County, Wisconsin, United States. Bruemmerville is …",
        "gold": false,
        "notInDocSeed": true
      },
      {
        "id": "musique_006379",
        "title": "John C. Petersen",
        "snippet": "John C. Petersen (November 2, 1842 – July 10, 1887) was an American butcher and farmer from Appleton, Wisconsin who served as a member of …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "John C. Petersen represented Outagamie County.",
          "proposition": "John C. Petersen served as a member of the Wisconsin State Assembly, representing Outagamie County."
        }
      },
      {
        "id": "musique_005920",
        "title": "Norman, Wisconsin",
        "snippet": "Norman is an unincorporated community located in the town of Carlton, Kewaunee County, Wisconsin, United States. Norman is located on …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_006197",
        "title": "Chase, Wisconsin",
        "snippet": "Chase is a town in Oconto County, Wisconsin, United States. The population was 2,082 at the 2000 census. The unincorporated communities of …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_001189",
        "title": "Nekoosa, Wisconsin",
        "snippet": "Nekoosa is a city in Wood County, Wisconsin, United States. Its name derives from the Ho-Chunk word, \"Nįįkuusra\", \"Nakrusa\", or \"Nįkusara\" …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "musique_003519",
        "title": "Nevels Corners, Wisconsin",
        "snippet": "Nevels Corners is an unincorporated community in the town of Dayton, Richland County, Wisconsin, United States. The community was named …",
        "gold": false,
        "notInDocSeed": true
      },
      {
        "id": "musique_009608",
        "title": "Kelly Brook, Wisconsin",
        "snippet": "Kelly Brook is an unincorporated community located in the town of Spruce, Oconto County, Wisconsin, United States. Kelly Brook is located …",
        "gold": false,
        "notInDocSeed": true
      },
      {
        "id": "musique_006374",
        "title": "Pulaski High School",
        "snippet": "Pulaski High School is a public high school in Pulaski, Wisconsin, in Brown County, Wisconsin (school district also serves parts of …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Pulaski High School located in Brown County.",
          "proposition": "The school district of Pulaski High School also serves parts of Shawano, Outagamie, and Oconto counties."
        }
      },
      {
        "id": "musique_008778",
        "title": "Clarks Mills, Wisconsin",
        "snippet": "Clarks Mills is an unincorporated community located in the town of Cato, Manitowoc County, Wisconsin, United States. Clarks Mills is …",
        "gold": false,
        "notInDocSeed": true
      }
    ],
    "searches": [
      {
        "query": "Erik Jensen birthplace county",
        "results": [
          {
            "id": "musique_008960",
            "title": "Erik Jensen (American football)",
            "snippet": "Erik Jensen (born October 11, 1980 in Appleton, Wisconsin) is a former American football tight end of the National Football League. He was …",
            "gold": true
          },
          {
            "id": "musique_000059",
            "title": "Erik Hort",
            "snippet": "Erik Hort (born February 16, 1987 in Montebello, New York) is an American soccer player who is currently a Free Agent.",
            "gold": false
          },
          {
            "id": "musique_006378",
            "title": "Jerome Quinn",
            "snippet": "Born in Green Bay, Wisconsin, Quinn was a realtor and served on the Green Bay Common Council, the Brown County, Wisconsin Board of …",
            "gold": true
          },
          {
            "id": "musique_007932",
            "title": "E Township, Maine",
            "snippet": "E is an unincorporated township located in Aroostook County, Maine, United States. It is part of the Central Aroostook Unorganized …",
            "gold": false
          },
          {
            "id": "musique_007980",
            "title": "Jehan Gordon-Booth",
            "snippet": "Gordon-Booth was born and raised in Peoria County, Illinois, where she attended Limestone High School in Bartonville, and attended Parkland …",
            "gold": false
          }
        ]
      }
    ],
    "runs": [
      {
        "runId": "t5__no_seed",
        "label": "No seed",
        "searches": 7,
        "correct": true,
        "listRecall": null
      },
      {
        "runId": "t5__rdr_doc_seed",
        "label": "documents only",
        "searches": 2,
        "correct": true,
        "listRecall": null
      },
      {
        "runId": "t5__rdr_lgrp3d1_seed",
        "label": "documents + triples + propositions",
        "searches": 1,
        "correct": true,
        "listRecall": null
      }
    ]
  },
  {
    "key": "fanout",
    "kind": "Fan-out list",
    "title": "Five entities, one search",
    "blurb": "The seed already holds the 2023 list and the pages of four of the five companies. One search returns the list's sector table, which gives the fifth headquarters.",
    "chain": [
      "Fortune Global 500, list of 2023: the top five companies",
      "Walmart, Saudi Aramco, State Grid, Amazon, China National Petroleum: one headquarters each"
    ],
    "dataset": "FanOutQA",
    "ds": "fanoutqa",
    "qid": "fanoutqa__e9b241d79ff08ba7",
    "runId": "t5__rdr_lgrp3_seed",
    "question": "Where are the headquarters of the top 5 companies on the Fortune Global 500 in 2023 located?",
    "goldAnswer": "Walmart: Bentonville, Arkansas, U.S; Saudi Aramco: Dhahran, Saudi Arabia; State Grid: Xicheng District, Beijing, China; Amazon: Seattle, Washington; China National Petroleum: Dongcheng District, Beijing, China",
    "answer": "The headquarters of the top 5 companies on the Fortune Global 500 in 2023 are located in: Walmart (Bentonville, Arkansas, USA), Saudi Aramco (Dhahran, Saudi Arabia), State Grid (Xicheng District, Beijing, China), Amazon (Bellevue/Seattle area, Washington, USA), and China National Petroleum (Dongcheng District, Beijing, China).",
    "grade": {
      "kind": "list",
      "recall": 1.0
    },
    "seed": [
      {
        "id": "fanoutqa_040065",
        "title": "Fortune Global 500 › list of 2023",
        "snippet": "The following is the list of Top 10 companies in 2023: Fortune Global 500 list of 2023 Rank Company Country Industry Revenue in USD 1 …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Fortune Global 500 includes Walmart.",
          "proposition": "Saudi Aramco is ranked 2nd on the Fortune Global 500 list of 2023."
        }
      },
      {
        "id": "fanoutqa_023013",
        "title": "List of largest companies by revenue › List",
        "snippet": "Ranks Name Industry Revenue Profit Employees Headquarters State-owned Ref. USD (in billions) 1 Amazon \"Amazon (company)\") Retail …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "fanoutqa_002894",
        "title": "Amazon (company) › Operations › Headquarters › Other major campuses",
        "snippet": "Amazon's European headquarters are in Luxembourg's capital, Luxembourg. Its UK headquarters are at Principal Place, Shoreditch, London. On …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Amazon has European headquarters in Luxembourg City.",
          "proposition": "Amazon's UK headquarters are located at Principal Place in Shoreditch, London."
        }
      },
      {
        "id": "fanoutqa_030093",
        "title": "State Grid Corporation of China",
        "snippet": "State Grid Corporation of China State Grid headquarters in Beijing's Xicheng District Trade name SGCC State Grid Native name 国家电网有限公司 …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "State Grid Corporation of China headquarters in Xicheng District, Beijing.",
          "proposition": "State Grid Corporation of China is headquartered in Xicheng District, Beijing, China."
        }
      },
      {
        "id": "fanoutqa_013918",
        "title": "Walmart › Corporate affairs",
        "snippet": "Walmart Home Office (headquarters) in Bentonville, Arkansas in June 2009 Walmart's current West Coast office complex in Sunnyvale, …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "Walmart headquartered in Bentonville, Arkansas.",
          "proposition": "Walmart is headquartered in the Home Office complex in Bentonville, Arkansas."
        }
      },
      {
        "id": "fanoutqa_013964",
        "title": "ExxonMobil › Corporate affairs › Headquarters and offices",
        "snippet": "ExxonMobil Building. Former ExxonMobil offices in Downtown Houston were vacated in early 2015. ExxonMobil's headquarters are located in the …",
        "gold": false,
        "notInDocSeed": false
      },
      {
        "id": "fanoutqa_040084",
        "title": "Fortune Global 500 › list of 2018 › Breakdown by industry",
        "snippet": "Industry Company Country Rank Revenue ($M) Aerospace & Defense \"Defense (military)\") Boeing United States United States 64 93,392 Airlines …",
        "gold": true,
        "notInDocSeed": false
      },
      {
        "id": "fanoutqa_040090",
        "title": "China National Petroleum Corporation",
        "snippet": "This article is about the state-owned enterprise in China. For the state-owned enterprise in Taiwan, see CPC Corporation. China National …",
        "gold": true,
        "notInDocSeed": false,
        "memories": {
          "triple": "China National Petroleum Corporation headquartered in Dongcheng District.",
          "proposition": "The headquarters of China National Petroleum Corporation are located in Dongcheng District, Beijing, China."
        }
      },
      {
        "id": "fanoutqa_040078",
        "title": "Fortune Global 500 › list of 2019",
        "snippet": "The following is the list of Top 10 companies: Fortune Global 500 list of 2019 Rank Company Country Industry Revenue in USD 1 Walmart …",
        "gold": true,
        "notInDocSeed": false
      },
      {
        "id": "fanoutqa_040062",
        "title": "Fortune Global 500 › list of 2024",
        "snippet": "The following is the list of Top 10 companies in 2024: Fortune Global 500 list of 2024 Rank Company Country Industry Revenue in USD 1 …",
        "gold": true,
        "notInDocSeed": false
      }
    ],
    "searches": [
      {
        "query": "Fortune Global 500 2023 top 5 companies headquarters",
        "results": [
          {
            "id": "fanoutqa_040065",
            "title": "Fortune Global 500 › list of 2023",
            "snippet": "The following is the list of Top 10 companies in 2023: Fortune Global 500 list of 2023 Rank Company Country Industry Revenue in USD 1 …",
            "gold": true
          },
          {
            "id": "fanoutqa_040066",
            "title": "Fortune Global 500 › list of 2023 › Breakdown by country/territory",
            "snippet": "These are the Top 10 countries/territories with the highest revenues from the Top 500 companies as of August 2023: Breakdown by …",
            "gold": true
          },
          {
            "id": "fanoutqa_040062",
            "title": "Fortune Global 500 › list of 2024",
            "snippet": "The following is the list of Top 10 companies in 2024: Fortune Global 500 list of 2024 Rank Company Country Industry Revenue in USD 1 …",
            "gold": true
          },
          {
            "id": "fanoutqa_040067",
            "title": "Fortune Global 500 › list of 2023 › Breakdown by region",
            "snippet": "As of August 2023, 28 (6%) of the Fortune Global 500 companies are located outside East Asia, North America, and Europe: Breakdown by …",
            "gold": true
          },
          {
            "id": "fanoutqa_040068",
            "title": "Fortune Global 500 › list of 2023 › Leadership by sector",
            "snippet": "The following are the top-ranked companies in 2023 for each sector: Sector Company Headquarters Overall rank Revenues ($M) Aerospace & …",
            "gold": true
          }
        ]
      }
    ],
    "runs": [
      {
        "runId": "t5__no_seed",
        "label": "No seed",
        "searches": 6,
        "correct": null,
        "listRecall": 0.2
      },
      {
        "runId": "t5__rdr_doc_seed",
        "label": "documents only",
        "searches": 4,
        "correct": null,
        "listRecall": 1.0
      },
      {
        "runId": "t5__rdr_lgrp3_seed",
        "label": "documents + triples + propositions",
        "searches": 1,
        "correct": null,
        "listRecall": 1.0
      }
    ]
  }
];
