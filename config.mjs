export const version = '1.2.0';
export const region = { id:'malatya', name:'Malatya', latitude:38.35, longitude:38.31, start:'20030901', end:'20250831' };
export const rules = { rainFraction:.78, fallowDemand:.45, soloBudget:2400, sharedBudget:4900 };
export const crops = {
 wheat: { names:['Buğday','Wheat'], family:'grass', start:'10-15', end:'07-10', phases:[.50,.24,.15,.11], kc:[.35,.75,1.15,.55], heat:30, ky:1.05 },
 barley: { names:['Arpa','Barley'], family:'grass', start:'10-01', end:'06-20', phases:[.52,.25,.13,.10], kc:[.35,.75,1.10,.50], heat:29, ky:1.05 },
 chickpea: { names:['Nohut','Chickpea'], family:'legume', start:'03-20', end:'07-30', phases:[.25,.24,.27,.24], kc:[.40,.75,1.00,.45], heat:34, ky:1.06 },
 lentil: { names:['Mercimek','Lentil'], family:'legume', start:'03-01', end:'06-30', phases:[.25,.25,.25,.25], kc:[.40,.70,1.00,.45], heat:32, ky:1.0 }
};
export const farms = [
 { id:'A', maxDeficit:20000, minCereals:6, minLegumes:0, name:['Yamaç','Hillside'], goal:['Su açığını azalt','Reduce water deficit'], soil:['Tınlı','Loam'], plots:[[1.1,76,32,'wheat'],[.8,91,45,'chickpea'],[1.2,62,25,'barley']] },
 { id:'B', yieldTarget:80, minCereals:5, minLegumes:0, name:['Ova','Lowland'], goal:['Tahıl sezonlarını koru','Maintain cereal seasons'], soil:['Killi tın','Clay loam'], plots:[[1.4,104,51,'barley'],[.7,99,45,'wheat'],[.9,92,39,'lentil']] },
 { id:'C', maxBare:1150, minCereals:5, minLegumes:2, name:['Dere','Creekside'], goal:['Ürün ailesi çeşitliliğini artır','Diversify crop families'], soil:['Kumlu tın','Sandy loam'], plots:[[.7,57,21,'lentil'],[1,64,24,'wheat'],[.8,66,26,'chickpea']] }
];
