var DB_DIR = 'db';
var sqlite = require('spatialite');
var debug = require('./debug.js');
var ready = false; /**���� ����������**/
var loaded_file = ''; /**����������� ����**/
var db = null;
var roads = []; /**������ �����**/
var nodes = [];/**������ �����**/
var index_from = []; /**��������� ������� ��� ��������� ������**/
var index_size = []; 
var n = 0; /**���������� ������ �����**/
var m = 0; /**���������� ��� �����**/
var INF = 999999999; /**������� �����**/
var margin = 0.6; /**����������� ���������� ��� ����������� ����� ����� ��� �������**/
var margin2 = 2.0;/**����������� ���������� ��� ����������� ����� ����� ��� �������**/

/**
* ���������� ������� � ��������� ����������� � ���� ������� ��������
* @param sql ������ �������
* @param callback ������� ��������� ������ � ������� ���������� ���������
* � ���� ������� ��������
**/
function query(sql, callback){
	db.spatialite(function(err) {
		db.all(sql, function(err, rows) {
			results = [];
			if ( rows != undefined ){
				if ( rows != null ){
					for ( var i = 0; i < rows.length; i++ ){
						results.push(rows[i]);
					}			
				}
			}
			callback(results);
		});
	});
}


/**
* ��������� ����� �� ���� � ���� ������� �������� � ������ � ������ roads + ���������� ��������� ��������
* @param callback ������� ��������� ������
* roads - ������ �������� ���� {node_from:node_from,node_to:node_to,name:name,cost:cost,length:length,lat_from:lat_from,lng_from:lng_from,lat_to:lat_to,lng_to:lng_to}
**/
function loadRoads(callback){
	var sql = "SELECT node_from, node_to, name, cost, length, Y(rn.geometry) "; 
		sql += "AS lat_from, X(rn.geometry) AS lng_from, Y(rn2.geometry) "; 
		sql += "AS lat_to, X(rn2.geometry) AS lng_to, AsGeoJSON(r.geometry) AS geometry ";  
		sql += "FROM roads r,roads_nodes rn, roads_nodes rn2 "; 
		sql += "WHERE r.node_from=rn.node_id AND r.node_to=rn2.node_id ORDER BY node_from,node_to";
	
	
	db.spatialite(function(err) {
		db.all(sql, function(err, rows) {
			if ( rows != undefined ){
				if ( rows != null ){
					//���������� � ������
					var geom = null;
					for ( var i = 0; i < rows.length; i++ ){
						roads.push(rows[i]);
						geom = JSON.parse(rows[i].geometry);
						geom.coordinates.reverse();
						roads.push({node_from:rows[i].node_to, node_to:rows[i].node_from,cost:rows[i].cost,length:rows[i].length,geometry:JSON.stringify(geom)});
					}
					m = roads.length;
					//���������
					roads.sort(function(x,y){ return x.node_from-y.node_from});
					
					var curr_from = 0;
					var prev_from = 0;
					for ( var i = 0; i < m; prev_from = curr_from,i++ ){
						curr_from = roads[i].node_from;
						if ( curr_from != prev_from ){ //���� from ����� ���������� ��� ��������� ������ � index_from
							if ( curr_from - 1 > index_from.length ){
								for ( var j = 0; j < (curr_from - 1 - index_from.length); j++ ){
									index_from.push(-1);
									index_size.push(0);
								}
							}
							index_from.push(i);
							index_size.push(1);
						}else{ //���� from ������ ����������� ��������� index_size
							index_size[index_size.length-1]++;
						}
					}			
				}
			}
			callback();
		});
	});
}

/**
* ��������� ����� ����� �� ���� � ���� ������� �������� � ������ � ������ nodes
* @param callback ������� ��������� ������
* nodes - ������ �������� ���� {node_id:node_id,cardinality:cardinality,lat:lat,lng:lng}
**/
function loadNodes(callback){
	var sql = "SELECT node_id, cardinality, Y(geometry) AS lat, X(geometry) AS lng FROM roads_nodes"; 
	db.spatialite(function(err) {
		db.all(sql, function(err, rows) {
			if ( rows != undefined ){
				if ( rows != null ){
					for ( var i = 0; i < rows.length; i++ ){
						nodes.push(rows[i]);
					}			
				}
			}
			n = nodes.length;
			callback();
		});
	});
}

/**
* ��������� ��������� ���� ����� �� ���� from � ���� to
**/
function getCost(from,to,banned){
	if (from == to ) return 0;
	for ( var i = 0; i < banned.length; i++ ){
		if ( from == banned[i] || to == banned[i] ) return INF;
	}
	if ( index_size[from-1] == 0 && index_size[to-1] == 0 ) return INF;
	for ( var i = index_from[from-1]; i < index_from[from-1] + index_size[from-1]; i++ ){
		if ( roads[i].node_from == from && roads[i].node_to == to ){
			return roads[i].cost;
		} 
	}
	return INF;
}

/**
* ��������� ��������� ( ��� ������� ����� ) ���� ����� �� ���� from � ���� to
**/
function getCoordinates(from,to){
	var geom = null;
	if (from == to ) return [];
	if ( index_size[from-1] == 0 && index_size[to-1] == 0 ) return [];
	for ( var i = index_from[from-1]; i < index_from[from-1] + index_size[from-1]; i++ ){
		if ( roads[i].node_from == from && roads[i].node_to == to ){
			geom = JSON.parse(roads[i].geometry);
			return geom.coordinates;
		} 
	}
	return [];
}

/**
* ��������� id ����� ����������� �������
**/
function getIncident(curr){
	var incident = [];
	if ( curr > n || curr < 1 ) return incident;
	for ( var i = index_from[curr-1]; i <  index_from[curr-1] + index_size[curr-1]; i++ ){
		incident.push(i);
	}
	return incident;
}

/**
* �������� ������ �� ����
* ������������� ��������� �������� ����������
* @param ������� ��������� ������
**/
function init(db_file, callback){
	if ( db_file == loaded_file ){
       callback(db_file);
       return;
	} 
    
    loaded_file = db_file;
    clear();
    console.log('load graph...');
    db = new sqlite.Database(DB_DIR + '/' + db_file);
    loadNodes(function(){
		loadRoads(function(){
			ready = true;
            console.log('graph from database '+ db_file +' loaded: nodes: ' + n + '; roads: ' + m);
            callback(db_file);
		})
	});
}

/**
* ������� ������ ���������� ����
* @param callback ������� ��������� ������
**/
function clear(){
    console.log('unload graph...');
    db = null;
    roads= [];
    nodes = [];
    index_from = [];
    index_size = [];
    n = 0;
    m = 0;
    ready = false;
}
/**
* ����������� �������� �������� � ����
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/

function routeQuery(from, to, callback){
	var start = latlng2node_id(from);
    var end = latlng2node_id(to);
	console.log(start+':'+end);
	var sql = "SELECT AsGeoJSON(geometry) AS geometry FROM roads_net WHERE ";
	sql += "NodeFrom=" + start + " AND NodeTo=" + end; 
	sql += " LIMIT 1;"
    //console.log(sql);
	db.spatialite(function(err) {
		db.get(sql, function(err, row) {
            //console.log(JSON.stringify(row));
            route = [];
			if ( row != undefined ){
				if ( row.geometry != null ){
					var obj = JSON.parse(row.geometry);
					route = obj.coordinates;
				}
			}
			//console.log(JSON.stringify(reverse(route)));
            callback(reverse(route));
		});
	});
}

/**
* ����������� �������� �� ��������� ��������
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/

function routeDijkstra(from, to, callback){
	var visited = []; /**���������� ������� � ���������� ������**/
    var label = [];/**����� ������**/
    var prev = [];/**���������� �������**/
	var cost = 0;
	var min = 0;
    start = latlng2node_id(from);
    end = latlng2node_id(to);
	console.log(start+':'+end);
	curr = start;
	var tempLabel = 0;
    for ( var i = 0; i < n; i++ ){
	   visited.push(0);
	   label.push(INF);
	   prev.push(0);
	}
	label[curr-1] = 0;
	while ( visited[end-1] == 0 ){
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			cost = getCost(curr,i+1,[]);
			tempLabel = label[curr-1] + cost;
			if ( tempLabel > INF ) tempLabel = INF;
			if ( label[i] > tempLabel ){
				label[i] = tempLabel;
				prev[i] = curr;
			}	
		}
		visited[curr-1] = 1;
		min = INF;
		index = curr-1;
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			if ( min > label[i] ){
				min = label[i];
				index = i;
			}	
		}
		if ( min == INF ) break; 
		curr = index+1;
		//console.log(curr);
	}
	if ( label[end-1] == INF ){
		callback([]);
		return false;
	}
	//����� �����������
    var lengthPath = label[end-1];
	var path = [];
	path.push(end);
	curr = end;
	while( prev[curr-1] != start ){
		path.push(prev[curr-1]);
		curr = prev[curr-1];
	}
	path.push(start);
	path.reverse();
	callback(path2route(path));
}

/**
* ����������� �������� �� ��������� �������� ������� 2
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function routeDijkstra2(from, to, callback){
    var visited = []; /**���������� ������� � ���������� ������**/
    var label = [];/**����� ������**/
    var prev = [];/**���������� �������**/
	var cost = 0;
	var min = 0;
    start = latlng2node_id(from);
    end = latlng2node_id(to);
	console.log(start+':'+end);
	curr = start;
	var tempLabel = 0;
    for ( var i = 0; i < n; i++ ){
	   visited.push(0);
	   label.push(INF);
	   prev.push(0);
	}
	label[curr-1] = 0;
	while ( visited[end-1] == 0 ){
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			cost = getCost(curr,i+1,[]);
			tempLabel = label[curr-1] + cost;
			if ( tempLabel > INF ) tempLabel = INF;
			if ( label[i] > tempLabel ){
				label[i] = tempLabel;
				prev[i] = curr;
			}	
		}
		visited[curr-1] = 1;
		min = INF;
		index = curr-1;
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			if ( min > label[i] ){
				min = label[i];
				index = i;
			}	
		}
		if ( min == INF ) break; 
		curr = index+1;
		//console.log(curr);
	}
	if ( label[end-1] == INF ){
		callback([]);
		return false;
	}
	//����� �����������
    var lengthPath = label[end-1];
	var path = [];
	path.push(end);
	curr = end;
	while( prev[curr-1] != start ){
		path.push(prev[curr-1]);
		curr = prev[curr-1];
	}
	path.push(start);
	path.reverse();
	callback(path2route(path));
}

/**
* ����������� �������� �� ��������� �������� ������� 3, � ��������� �����
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/

function routeDijkstra3(from, to, callback){
	var visited = []; /**���������� ������� � ���������� ������**/
    var label = [];/**����� ������**/
    var prev = [];/**���������� �������**/
    var nodes_part = []; /**��������� ������ ����� ������������� ������**/
	var u = 0; /**����� ���������� ������� ����� ������������� ������**/

	//���������� �������
	
	var delta = Math.max(Math.abs(from[0] - to[0]),Math.abs(from[1] - to[1]))*margin;
	var lat_min = Math.min(from[0], to[0]) - delta;
	if ( lat_min < -90 ){ lat_min = -90;} else if ( lat_min > 90 ){lat_min = 90;}
	var lat_max = Math.max(from[0], to[0]) + delta;
	if ( lat_min < -90 ){ lat_min = -90;} else if ( lat_min > 90 ){lat_min = 90;}
	var lng_min = Math.min(from[1], to[1]) - delta;
	if ( lng_min < -180 ){ lng_min = 360 + lng_min;} else if ( lng_min > 180 ){ lng_min = lng_min - 360;}
	var lng_max = Math.max(from[1], to[1]) + delta;
	if ( lng_max < -180 ){ lng_max = 360 + lng_max;} else if ( lng_max > 180 ){ lng_max = lng_max - 360;}
	
	console.log('lat_min: '+lat_min+'\nlat_max: '+lat_max+'\nlng_min: '+lng_min+'\nlng_max: '+lng_max);
	//�������� ������ ����� �����
	for ( var i = 0; i < n; i++ ){
		var lat = nodes[i].lat;
		var lng = nodes[i].lng;
		if ( lat < lat_max && lat > lat_min && lng < lng_max && lng > lng_min ){
			nodes_part.push(i);
		}
	}
	u = nodes_part.length;
	console.log(u);
	//���������� ������ � ����� � ��������� �����
	var start = latlng2node_id_part(from,nodes_part,u);
    var end = latlng2node_id_part(to,nodes_part,u);
	console.log(start+':'+end);
	//������ ��������
	var curr = start;
    for ( var i = 0; i < u; i++ ){
	   visited.push(0);
	   label.push(INF);
	   prev.push(0);
	}
    var tempLabel = 0;
	visited[curr] = 1;
	label[curr] = 0;
	while(visited[end] == 0){
		for ( i = 0; i < u; i++ ){
			if ( visited[i] == 1 ) continue;
			var cost = getCost(nodes_part[curr]+1,nodes_part[i]+1, []);
			tempLabel = (cost + label[curr]);
			if (tempLabel > INF) tempLabel = INF;
			if ( label[i] > tempLabel){
				label[i] = tempLabel;
				prev[i] = curr;
			}//end if
		}//end for
		var min = INF;
		var index = curr;
		for ( var i = 0; i < u; i++ ){
			if ( visited[i] == 1 ) continue;
			if ( label[i] < min ){
				min = label[i];
				index = i;
			}
		}//end for
		visited[index] = 1; //����������� ���� ���������� �����
		curr = index;
		if ( min == INF ) break;
	}//end while
	if ( label[end] == INF ){
		callback([]);
		return false;
	} 
	//����� �����������
	var lengthPath = label[end];
	var path = [];
	path.push(nodes_part[end]+1);
	curr = end;
	while( prev[curr] != start ){
		path.push(nodes_part[prev[curr]]+1);
		curr = prev[curr];
	}
	path.push(nodes_part[start]+1);
	path.reverse();
	callback(path2route(path));
}


/**
* ����������� �������� �� ��������� �������� ������� 4 � ������� ������ ����������
* @param from ��������� �����
* @param to �������� �����
* @param enemy ������ ������ ���������� ���� [{lat:lat, lng:lng, radius:radius}, ...]
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function routeDijkstraEnemy(from, to, enemy, callback){
    var visited = []; /**���������� ������� � ���������� ������**/
    var label = [];/**����� ������**/
    var prev = [];/**���������� �������**/
	var cost = 0;
	var min = 0;
    start = latlng2node_id(from);
    end = latlng2node_id(to);
	console.log(start+':'+end);
	curr = start;
	var banned = getBannedNodesId(enemy);
	var tempLabel = 0;
    for ( var i = 0; i < n; i++ ){
	   visited.push(0);
	   label.push(INF);
	   prev.push(0);
	}
	label[curr-1] = 0;
	while ( visited[end-1] == 0 ){
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			cost = getCost(curr,i+1,banned);
			tempLabel = label[curr-1] + cost;
			if ( tempLabel > INF ) tempLabel = INF;
			if ( label[i] > tempLabel ){
				label[i] = tempLabel;
				prev[i] = curr;
			}	
		}
		visited[curr-1] = 1;
		min = INF;
		index = curr-1;
		for ( var i = 0; i < n; i++ ){
			if ( visited[i] == 1 ) continue;
			if ( min > label[i] ){
				min = label[i];
				index = i;
			}	
		}
		if ( min == INF ) break; 
		curr = index+1;
		//console.log(curr);
	}
	if ( label[end-1] == INF ){
		callback([]);
		return false;
	}
	//����� �����������
    var lengthPath = label[end-1];
	var path = [];
	path.push(end);
	curr = end;
	while( prev[curr-1] != start ){
		path.push(prev[curr-1]);
		curr = prev[curr-1];
	}
	path.push(start);
	path.reverse();
	callback(path2route(path));
}


/**
* ����������� �������� �� ��������� �������� ������� 5 � ������� ������ ����������
* � c ��������� �����
* @param from ��������� �����
* @param to �������� �����
* @param enemy ������ ������ ���������� ���� [{lat:lat, lng:lng, radius:radius}, ...]
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function routeDijkstraEnemy2(from, to, enemy, callback){
    var visited = []; /**���������� ������� � ���������� ������**/
    var label = [];/**����� ������**/
    var prev = [];/**���������� �������**/
	var cost = 0;
	var min = 0;
	var nodes_part = []; /**��������� ������ ����� ������������� ������**/
	var u = 0; /**����� ���������� ������� ����� ������������� ������**/

	//���������� �������
	
	var delta = Math.max(Math.abs(from[0] - to[0]),Math.abs(from[1] - to[1]))*margin2;
	var lat_min = Math.min(from[0], to[0]) - delta;
	if ( lat_min < -90 ){ lat_min = -90;} else if ( lat_min > 90 ){lat_min = 90;}
	var lat_max = Math.max(from[0], to[0]) + delta;
	if ( lat_min < -90 ){ lat_min = -90;} else if ( lat_min > 90 ){lat_min = 90;}
	var lng_min = Math.min(from[1], to[1]) - delta;
	if ( lng_min < -180 ){ lng_min = 360 + lng_min;} else if ( lng_min > 180 ){ lng_min = lng_min - 360;}
	var lng_max = Math.max(from[1], to[1]) + delta;
	if ( lng_max < -180 ){ lng_max = 360 + lng_max;} else if ( lng_max > 180 ){ lng_max = lng_max - 360;}
	
	console.log('lat_min: '+lat_min+'\nlat_max: '+lat_max+'\nlng_min: '+lng_min+'\nlng_max: '+lng_max);
	//�������� ������ ����� �����
	for ( var i = 0; i < n; i++ ){
		var lat = nodes[i].lat;
		var lng = nodes[i].lng;
		if ( lat < lat_max && lat > lat_min && lng < lng_max && lng > lng_min ){
			nodes_part.push(i);
		}
	}
	u = nodes_part.length;
    //���������� ������ � ����� � ��������� �����
	var start = latlng2node_id_part(from,nodes_part,u);
    var end = latlng2node_id_part(to,nodes_part,u);
	console.log(start+':'+end);
	var curr = start;
    for ( var i = 0; i < u; i++ ){
	   visited.push(0);
	   label.push(INF);
	   prev.push(0);
	}
    var tempLabel = 0;
	visited[curr] = 1;
	label[curr] = 0;
	var banned = getBannedNodesId(enemy);
	while ( visited[end] == 0 ){
		for ( var i = 0; i < u; i++ ){
			if ( visited[i] == 1 ) continue;
			cost = getCost(nodes_part[curr]+1,nodes_part[i]+1,banned);
			tempLabel = label[curr] + cost;
			if ( tempLabel > INF ) tempLabel = INF;
			if ( label[i] > tempLabel ){
				label[i] = tempLabel;
				prev[i] = curr;
			}	
		}
		visited[curr] = 1;
		min = INF;
		index = curr;
		for ( var i = 0; i < u; i++ ){
			if ( visited[i] == 1 ) continue;
			if ( min > label[i] ){
				min = label[i];
				index = i;
			}	
		}
		if ( min == INF ) break; 
		curr = index;
		//console.log(curr);
	}
	if ( label[end] == INF ){
		callback([]);
		return false;
	}
	//����� �����������
	var lengthPath = label[end];
	var path = [];
	path.push(nodes_part[end]+1);
	curr = end;
	while( prev[curr] != start ){
		path.push(nodes_part[prev[curr]]+1);
		curr = prev[curr];
	}
	path.push(nodes_part[start]+1);
	path.reverse();
	callback(path2route(path));
}


/**
* ����������� �������� ������� ������ � ������
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function bypassingWide(from, to, callback){
	var queue = []; /**�������**/
	var used = []; /**���������� �������**/
	var prev = []; /**������ ������**/
	for ( var i = 0; i < n; i++ ){
		used[i] = false;
		prev[i] = 0;
	}
	var start = latlng2node_id(from);
    var end = latlng2node_id(to);
	console.log(start+':'+end);
	var curr = start;
	var id = null;
	used[start-1] = true;
	queue.push(start);
	while( queue.length > 0 ){
		curr = queue[0];
		if ( curr == end ) break;
		for ( var i = index_from[curr-1]; i < index_from[curr-1] + index_size[curr-1]; i++ ){
			id = roads[i].node_to;
			if ( !used[id-1] ){
				used[id-1] = true;
				queue.push(id);
				prev[id-1] = curr;
			}
		}
		queue.shift();
	}
	if ( !used[end-1] ){
		callback([]);
		return false;
	}
	//����� �����������
	var path = [];
	path.push(end);
	curr = end;
	while( prev[curr-1] != start ){
		path.push(prev[curr-1]);
		curr = prev[curr-1];
	}
	path.push(start);
	path.reverse();
	callback(path2route(path));
}

/**
* ����������� �������� ������� ������ � ������ � ������� ������ ����������
* @param from ��������� �����
* @param to �������� �����
* @param enemy ������ ������ ���������� ���� [{lat:lat, lng:lng, radius:radius}, ...]
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function bypassingWideEnemy(from, to, enemy, callback){
	var queue = []; /**�������**/
	var used = []; /**���������� �������**/
	var prev = []; /**������ ������**/
	for ( var i = 0; i < n; i++ ){
		used[i] = false;
		prev[i] = 0;
	}
	var start = latlng2node_id(from);
    var end = latlng2node_id(to);
	console.log(start+':'+end);
	var curr = start;
	var id = null;
	used[start-1] = true;
	queue.push(start);
	var banned = getBannedNodesId(enemy);
	while( queue.length > 0 ){
		curr = queue[0];
		if ( curr == end ) break;
		for ( var i = index_from[curr-1]; i < index_from[curr-1] + index_size[curr-1]; i++ ){
			id = roads[i].node_to;
			if ( banned.indexOf(id) != -1 ) continue;
			if ( !used[id-1] ){
				used[id-1] = true;
				queue.push(id);
				prev[id-1] = curr;
			}
		}
		queue.shift();
	}
	if ( !used[end-1] ){
		callback([]);
		return false;
	}
	//����� �����������
	var path = [];
	path.push(end);
	curr = end;
	while( prev[curr-1] != start ){
		path.push(prev[curr-1]);
		curr = prev[curr-1];
	}
	path.push(start);
	path.reverse();
	callback(path2route(path));
}

/**
* ����������� �������� �������� ����������
* @param from ��������� �����
* @param to �������� �����
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function routeWave(from, to, callback){
	var waveLabel = []; /**�������� �����**/
	var T = 0;/**�����**/
	var oldFront = [];/**������ �����**/
	var newFront = [];/**����� �����**/
	var prev = []; /**������ ������**/
	var curr = null;
	var id = null;
	for ( var i = 0; i < n; i++ ){
		waveLabel[i] = -1;
		prev[i] = 0;
	}
	var start = latlng2node_id(from);
    var end = latlng2node_id(to);
	console.log(start+':'+end);
	waveLabel[start-1] = 0;
	oldFront.push(start);
	while (true){
		//console.log(JSON.stringify(oldFront));
		for ( var i = 0; i < oldFront.length; i++ ){
			curr = oldFront[i];
			//console.log('curr='+curr);
			for ( j = index_from[curr-1]; j < index_from[curr-1] + index_size[curr-1]; j++ ){
				id = roads[j].node_to;
				//console.log('id='+id);
				//console.log('waveLabel[id]='+waveLabel[id-1] );
				if ( waveLabel[id-1] == -1 ){
					waveLabel[id-1] = T + 1;
					newFront.push(id);
					prev[id-1] = curr;
				}
				
				if ( id == end ){
					//������� �������
					//����� �����������
					var path = [];
					path.push(end);
					curr = end;
					while( prev[curr-1] != start ){
						path.push(prev[curr-1]);
						curr = prev[curr-1];
					}
					path.push(start);
					path.reverse();
					callback(path2route(path));
					return true;
				}
			}
		}
		if ( newFront.length == 0 ){
			callback([]);
			return false;
		}
		oldFront = newFront;
		newFront = [];
		T++;
	}
}

/**
* ����������� �������� �������� ���������� � ������� ������ ����������
* @param from ��������� �����
* @param to �������� �����
* @param enemy ������ ������ ���������� ���� [{lat:lat, lng:lng, radius:radius}, ...]
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function routeWaveEnemy(from, to, enemy, callback){
	var waveLabel = []; /**�������� �����**/
	var T = 0;/**�����**/
	var oldFront = [];/**������ �����**/
	var newFront = [];/**����� �����**/
	var prev = []; /**������ ������**/
	var curr = null;
	var id = null;
	for ( var i = 0; i < n; i++ ){
		waveLabel[i] = -1;
		prev[i] = 0;
	}
	var start = latlng2node_id(from);
    var end = latlng2node_id(to);
	console.log('routeWaveEnemy:'+start+':'+end);
	waveLabel[start-1] = 0;
	oldFront.push(start);
	var banned = getBannedNodesId(enemy);
	while (true){
		//console.log(JSON.stringify(oldFront));
		for ( var i = 0; i < oldFront.length; i++ ){
			curr = oldFront[i];
			//console.log('curr='+curr);
			for ( j = index_from[curr-1]; j < index_from[curr-1] + index_size[curr-1]; j++ ){
				id = roads[j].node_to;
				if ( banned.indexOf(id) != -1 ) continue;
				//console.log('id='+id);
				//console.log('waveLabel[id]='+waveLabel[id-1] );
				if ( waveLabel[id-1] == -1 ){
					waveLabel[id-1] = T + 1;
					newFront.push(id);
					console.log('routeWaveEnemy: id='+id);
					prev[id-1] = curr;
				}
				
				if ( id == end ){
					//������� �������
					//����� �����������
					var path = [];
					path.push(end);
					curr = end;
					while( prev[curr-1] != start ){
						path.push(prev[curr-1]);
						curr = prev[curr-1];
					}
					path.push(start);
					path.reverse();
					callback(path2route(path));
					return true;
				}
			}
		}
		if ( newFront.length == 0 ){
			callback([]);
			return false;
		}
		oldFront = newFront;
		newFront = [];
		T++;
	}
}


/**
* ����� �������� �� ����� �� �������� ��� � ������� ������ ����������
* �������� ���������� 
* @param index ����� �������
* @param from ��������� ����� ���� {lat:lat, lng:lng, radius:radius}
* @param to  �������� ����� (����) ���� {lat:lat, lng:lng, radius:radius}
* @param enemy ������ ������ ���������� ���� [{lat:lat, lng:lng, radius:radius}, ...]
* @param callback ������� ��������� ������ � ������� ���������� ��������� � ����
* true(���� ������� ������) ��� false (���� �� ������)
**/
function findRouteToBase(index, from, to, enemy, callback){
	//console.log(from,to,enemy);
	//callback([]); return;
	var waveLabel = []; /**�������� �����**/
	var T = 0;/**�����**/
	var oldFront = [];/**������ �����**/
	var newFront = [];/**����� �����**/
	var prev = []; /**������ ������**/
	var curr = null;
	var id = null;
	var start = null;
	for ( var i = 0; i < n; i++ ){
		waveLabel[i] = -1;
		prev[i] = 0;
	}
	if ( index != 0 ){
		/*�������� ����� � ����. �������*/
		start = latlng2node_id([from.lat + from.radius*(2*Math.random()-1),from.lng + from.radius*(2*Math.random()-1)]);
	}else{
		start = latlng2node_id([from.lat,from.lng]);
	} 
	
	var targets = getTargetsNodesId2(to);
	console.log('findRouteToBase:'+JSON.stringify(start)+':'+JSON.stringify(targets));
	waveLabel[start-1] = 0;
	oldFront.push(start);
	var banned = getBannedNodesId2(from, enemy);
    
	while (true){
		//console.log(JSON.stringify(oldFront));
		for ( var i = 0; i < oldFront.length; i++ ){
			curr = oldFront[i];
			//console.log('curr='+curr);
			for ( j = index_from[curr-1]; j < index_from[curr-1] + index_size[curr-1]; j++ ){
				id = roads[j].node_to;
				if ( banned.indexOf(id) != -1 ) continue;
				//console.log('id='+id);
				//console.log('waveLabel[id]='+waveLabel[id-1] );
				if ( waveLabel[id-1] == -1 ){
					waveLabel[id-1] = T + 1;
					newFront.push(id);
					prev[id-1] = curr;
				}
				
				if ( targets.indexOf(id) != -1 ){
					//������� �������
					//����� �����������
					var end = targets[targets.indexOf(id)];
					var path = [];
					path.push(end);
					curr = end;
					while( prev[curr-1] != start ){
						path.push(prev[curr-1]);
						curr = prev[curr-1];
					}
					path.push(start);
					path.reverse();
					callback(path2route(path));
					return true;
				}
			}
		}
		if ( newFront.length == 0 ){
			if ( index < 10 ){
				index++;
				findRouteToBase(index, from, to, enemy, callback);
				return false;
			}else{
				callback([]);
				return false;
			}
		}
		oldFront = newFront;
		newFront = [];
		T++;
	}
}

/**
* �������������� ������������������ id ����� � ������ ����
* � ����
* ������� ����� [[lat1, lng1], [lat2,lng2],...]]
* @param path ������������������ �����
* @return route ������ ����� [[lat1, lng1], [lat2,lng2],...]]
**/
function path2route(path){
	var route = [];
	var len = path.length;
	var prev = 0;
	var geom = null;
	for ( var curr = 0; curr < len; prev = curr, curr++ ){
		geom = getCoordinates(path[prev],path[curr]);
		for ( var i = 0; i < geom.length; i++ ){
			route.push(geom[i]);
		}
	}
	return reverse(route);
}

/**
* ������ ������� ������ � ������� � ������� �����
**/
function reverse(route){
    var reverse_route = [];
    for (var i = 0; i < route.length; i++){
        var dot = [route[i][1], route[i][0]];
        reverse_route.push(dot);
    }
    return reverse_route;
}

/**
* ������ ������� ������ � ������� � ������� �������� �����
**/
function reverse2(route){
    var reverse_route = [];
    for (var i = 0; i < route.length; i++){
        reverse_route.push(reverse(route[i]));
    }
    return reverse_route;
}

/**
* ��������� ��������� ���� �� id
* @param node_id id ����
* @return ������ ��������� [lat,lng]
**/
function node_id2latlng(node_id){
	if ( node_id < 0 || node_id >= n ) return [undefined, undefined];
	return [nodes[node_id - 1].lat, nodes[node_id - 1].lng];
}

/**
* ��������� id ���� �� �����������
* @param dot ������ ��������� [lat,lng]
* @return id ���� 
**/
function latlng2node_id(dot){
	var node_id = 1;
	var minDist = distance(dot,nodes[1]);
	for ( var i = 0; i < n; i++ ){
		var currDist = distance(dot, nodes[i]);
		if ( currDist < minDist ){
			node_id = nodes[i].node_id;
			minDist = currDist;
		}
	}
	return node_id;
}

/**
* ��������� id ���� �� ����������� � ��������� �����
* @param dot ������ ��������� [lat,lng]
* @return id ���� 
**/
function latlng2node_id_part(dot,nodes_part,u){
	var node_id = 0;
	var minDist = distance(dot,nodes[nodes_part[0]]);
	for ( var i = 0; i < u; i++ ){
		var currDist = distance(dot, nodes[nodes_part[i]]);
		if ( currDist < minDist ){
			node_id = i;
			minDist = currDist;
		}
	}
	return node_id;
}

/**
* ���������� �������� ���������� ����� ������ � ����� �����
* @param dot �����, �������� ��� ������ ��������� [lat,lng]
* @param node ���� �����, �������� ��� ������ ���� {node_id:node_id,lat:lat,lng:lng }
* @return ������� ���������� (��� ����� ��������) 
**/
function distance(dot, node){
	return (dot[0]-node.lat)*(dot[0]-node.lat) + (dot[1]-node.lng)*(dot[1]-node.lng);
}

/**
* ����� ���� �����
**/
function getAllRoads(callback){
	var allroads = [];
	var geom = null;
	for ( var i = 0; i < m; i++ ){
		geom = JSON.parse(roads[i].geometry);
		allroads.push(geom.coordinates);
	}
	callback(reverse2(allroads));
}

/**
* ����� ���� �����
**/
function getAllNodes(callback){
	var allnodes = [];
	for ( var i = 0; i < n; i++ ){
		allnodes.push([nodes[i].lat,nodes[i].lng]);
	}
	callback(allnodes);
}

/**
* ����� ���� ����������� �����
**/
function getRestirctedNodes(enemy, callback){
	var restricted = [];
	for ( var i = 0; i < enemy.length; i++ ){
		for ( var j = 0; j < n; j++ ){
			if ( rastGrad2([enemy[i].lat,enemy[i].lng],nodes[j]) <= enemy[i].radius ){
				restricted.push([nodes[j].lat,nodes[j].lng]);
			}
		}
	}
	callback(restricted);
}

/**
* ��������� ���� ����������� �����
**/
function getBannedNodesId(enemy){
	var restricted = [];
	for ( var i = 0; i < enemy.length; i++ ){
		for ( var j = 0; j < n; j++ ){
			if ( rastGrad2([enemy[i].lat,enemy[i].lng],nodes[j]) <= enemy[i].radius ){
				restricted.push(j+1);
			}
		}
	}
	return restricted;
}

/**
* ��������� ���� ����������� ����� 2 ������� (��������� ���� � ������� �����)
**/
function getBannedNodesId2(from, enemy){
	var restricted = [];
	var condition = false;
    for ( var i = 0; i < enemy.length; i++ ){
		for ( var j = 0; j < n; j++ ){
			condition = rastGrad2([enemy[i].lat,enemy[i].lng],nodes[j]) <= enemy[i].radius &&
                        rastGrad2([from.lat,from.lng],nodes[j]) >= from.radius;
            if ( condition ){
				restricted.push(j+1);
			}
		}
	}
	return restricted;
}

/**
* ��������� ���� ������� �����
**/
function getTargetsNodesId(to){
	var targets = [];
	for ( var i = 0; i < to.length; i++ ){
		targets.push(latlng2node_id([to[i][0], to[i][1]]));
	}
	return targets;
}

/**
* ��������� ���� ������� ����� (����� � ������� ����)
**/
function getTargetsNodesId2(to){
	var targets = [];
	for ( var i = 0; i < n; i++ ){
		var rast = rastGrad2([to.lat,to.lng],nodes[i]);
		if (  rast <= to.radius ){
			targets.push(nodes[i].node_id);
		}
	}
	return targets;
}

/**
* ����������� �����
* @param dot ������ ����� ���� {lat:lat, lng:lng,radius:radius}
* @return dot_new ������ ����� ���� {lat:lat, lng:lng,radius:radius}
**/
function randomMoveDot(dot){
	var radius = dot.radius;
	var newDot = {lat:0, lng:0, radius: radius};
	newDot.lat = dot.lat + radius * (2 * Math.random() - 1);
	newDot.lng = dot.lng + radius * (2 * Math.random() - 1);
	return newDot;
}

/**
* ���������� ���������� �� �����  � ��������
* @param do1,dot2 �����, �������� ��������� ���������� [lat,lng]
**/
function rastGrad(dot1,dot2){

	/**���������� ���� �����**/
	var llat1 = dot1[0];
	var llong1 = dot1[1];

	var llat2 = dot2[0];
	var llong2 = dot2[1];

	/**� ��������**/
	var lat1 = llat1*Math.PI/180;
	var lat2 = llat2*Math.PI/180;
	var long1 = llong1*Math.PI/180;
	var long2 = llong2*Math.PI/180;

	/**�������� � ������ ����� � ������� ������**/
	var cl1 = Math.cos(lat1)
	var cl2 = Math.cos(lat2)
	var sl1 = Math.sin(lat1)
	var sl2 = Math.sin(lat2)
	var delta = long2 - long1
	var cdelta = Math.cos(delta)
	var sdelta = Math.sin(delta)

	/**���������� ����� �������� �����**/
	var y = Math.sqrt(Math.pow(cl2*sdelta,2)+Math.pow(cl1*sl2-sl1*cl2*cdelta,2))
	var x = sl1*sl2+cl1*cl2*cdelta
	var ad = Math.atan2(y,x)
	var dist = ad*180/Math.PI;
	return dist;
}

/**
* ���������� ���������� �� �����  � ��������
* @param dot ����f, �������� �������� ���������� [lat,lng]
* @param node ���� �����, �������� ��� ������ ���� {node_id:node_id,lat:lat,lng:lng }
**/
function rastGrad2(dot, node){
    return rastGrad(dot, [node.lat, node.lng]);
}

/**
* ���������� ���� ����������
**/
function getReady(){
	return ready;
}

exports.init = init;
exports.query = query;
exports.loadNodes = loadNodes;
exports.latlng2node_id = latlng2node_id;
exports.routeDijkstra = routeDijkstra;
exports.routeDijkstra2 = routeDijkstra2;
exports.routeDijkstra3 = routeDijkstra3;
exports.routeDijkstraEnemy = routeDijkstraEnemy;
exports.routeDijkstraEnemy2 = routeDijkstraEnemy2;
exports.getCost = getCost;
exports.routeQuery = routeQuery;
exports.getAllRoads = getAllRoads;
exports.getAllNodes = getAllNodes;
exports.getRestirctedNodes = getRestirctedNodes;
exports.bypassingWide = bypassingWide;
exports.bypassingWideEnemy = bypassingWideEnemy;
exports.routeWave = routeWave;
exports.routeWaveEnemy = routeWaveEnemy;
exports.findRouteToBase = findRouteToBase;
exports.getReady = getReady;