export const buildingKeys = { all: ["buildings"] as const, list: (s?:string)=>["buildings","list",s??""] as const, one:(id:number)=>["buildings",id] as const };
