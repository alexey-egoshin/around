var sqlite = require('spatialite');
var debug = require('./debug.js');
var util = require('util');
var fs = require('fs');
var roads = []; /**массив дорог**/
var nodes = [];/**массив узлов**/
var index_from = []; /**индексные таблицы для ускорения поиска**/
var index_size = []; 
var n = 0; /**количество вершин графа**/
var m = 0; /**количество дуг графа**/
var INF = 999999999; /**большое число**/
var margin = 0.6; /**коэффициент расширения для определения части графа для обсчета**/
var margin2 = 2.0;/**коэффициент расширения для определения части графа для обсчета**/
var report_file = 'check_graph.txt';

var argv = process.argv;
if (argv[2] == null){
	console.log('Usdage: node check_graph <db_filename>');
	process.exit(0);
}
var db = new sqlite.Database(argv[2]);

/**
* получение дорог из базы в виде массива объектов и запись в массив roads + заполнение индексных массивов
* @param callback функция обратного вызова
* roads - массив объектов вида {node_from:node_from,node_to:node_to,name:name,cost:cost,length:length,lat_from:lat_from,lng_from:lng_from,lat_to:lat_to,lng_to:lng_to}
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
					//записываем в массив
					var geom = null;
					for ( var i = 0; i < rows.length; i++ ){
						roads.push(rows[i]);
						geom = JSON.parse(rows[i].geometry);
						geom.coordinates.reverse();
						roads.push({node_from:rows[i].node_to, node_to:rows[i].node_from,cost:rows[i].cost,length:rows[i].length,geometry:JSON.stringify(geom)});
					}
					m = roads.length;
					//сортируем
					roads.sort(function(x,y){ return x.node_from-y.node_from});
					
					var curr_from = 0;
					var prev_from = 0;
					for ( var i = 0; i < m; prev_from = curr_from,i++ ){
						curr_from = roads[i].node_from;
						if ( curr_from != prev_from ){ //если from новый записываем его начальный индекс в index_from
							if ( curr_from - 1 > index_from.length ){
								for ( var j = 0; j < (curr_from - 1 - index_from.length); j++ ){
									index_from.push(-1);
									index_size.push(0);
								}
							}
							index_from.push(i);
							index_size.push(1);
						}else{ //если from старый увеличиваем последний index_size
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
* получение узлов графа из базы в виде массива объектов и запись в массив nodes
* @param callback функция обратного вызова
* nodes - массив объектов вида {node_id:node_id,cardinality:cardinality,lat:lat,lng:lng}
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
* получение стоимости дуги графа из узла from в узел to
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
* получение геометрии ( как массива точек ) дуги графа из узла from в узел to
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
* получение id узлов инцидентных данному
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
* загрузка данных из базы
* инициализация начальных значений переменных
* @param функция обратного вызова
**/
function init(callback){
	console.log('load graph...');
	loadNodes(function(){
		loadRoads(function(){
			callback();
		})
	});
}


/**
* определение маршрута методом обхода в ширину
* @param from начальная точка
* @param to конечная точка
* @param callback функция обратного вызова в которую передается результат в виде
* массива точек [[lat1, lng1], [lat2,lng2],...]]
**/
function bypassingWide(from, to, callback){
	var queue = []; /**очередь**/
	var used = []; /**посещенные вершины**/
	var prev = []; /**предки вершин**/
	for ( var i = 0; i < n; i++ ){
		used[i] = false;
		prev[i] = 0;
	}
	var start = from;
    var end = to;
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
	//вывод результатов
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
* определение маршрута волновым алгоритмом
* @param from начальная точка
* @param to конечная точка
* @param callback функция обратного вызова в которую передается результат в виде
* массива точек [[lat1, lng1], [lat2,lng2],...]]
**/
function routeWave(from, to, callback){
	var waveLabel = []; /**волновая метка**/
	var T = 0;/**время**/
	var oldFront = [];/**старый фронт**/
	var newFront = [];/**новый фронт**/
	var prev = []; /**предки вершин**/
	var curr = null;
	var id = null;
	for ( var i = 0; i < n; i++ ){
		waveLabel[i] = -1;
		prev[i] = 0;
	}
	var start = from;
    var end = to;
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
					//решение найдено
					//вывод результатов
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

function findEmptyNodes(){
	var empty = [];
	var lastOutputLen = 0;
	var progress = '';
	
	for ( var i = 0; i < n; i++ ){
		progress = (i/n * 100).toFixed(6)+'%';
		var hasCurve = false;
		for ( var j = 0; j < m; j++ ){
			if ( roads[j].node_to == nodes[i].node_id || roads[j].node_from == nodes[i].node_id ) hasCurve = true;
		}
		if ( !hasCurve ) empty.push(nodes[i].node_id);
		/**вывод прогресса**/
		for ( var k = 0; k < lastOutputLen; k++ ){
			util.print('\b');
		}
		util.print(progress);
		lastOutputLen = progress.length;
	}
	return empty;	
}

function findEmptyNodes2(){
	var empty = [];
	var lastOutputLen = 0;
	var progress = '';
	var indexCurve = null;
	var size = 0;
	
	for ( var i = 0; i < n; i++ ){
		indexCurve = null;
		progress = (i/n * 100).toFixed(6)+'%';
		indexCurve = index_from[i];
		size = index_size[i];
		
		if ( indexCurve == -1 && size == 0 ) empty.push(nodes[i].node_id);
		/**вывод прогресса**/
		for ( var k = 0; k < lastOutputLen; k++ ){
			util.print('\b');
		}
		util.print(progress);
		lastOutputLen = progress.length;
	}
	return empty;	
}

init(function(){
	util.print("Begin check...\n");
	var empty = findEmptyNodes2();
	console.log('Result: all nodes: ' + n +'; empty nodes: ' + empty.length );
	fs.writeFile(report_file, 'Empty nodes id: ' + JSON.stringify(empty),function(){
		console.log('Report was saved in file ' + report_file);
	});
});