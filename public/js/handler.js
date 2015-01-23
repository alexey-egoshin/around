var start = null; //координаты стартовой точки
var end = null; //координаты конечной точки
var startPoint = null; //круг начальной точки
var endPoint = null; //круг конечной точки
var route_line = L.polyline([],{color:'blue'}).addTo(map);
var roads = []; //массив полилиний для дорог
var nodes = []; //массив точек для узлов
var enemies = []; //массив объектов вражеских полков
var enemyCircle = []; //массив кругов вражеских полков
var radius = 0.01; //радиус действия полка
var restr_nodes = []; //массив кругов запрещенных узлов

/**
* установка начальной и конечной точек на карте
**/
map.on('click',function(e){
	if ( start == null ){
		start = [e.latlng.lat,e.latlng.lng];
		startPoint = L.circle(L.latLng(start[0],start[1]),5,{color:'red'}).addTo(map);
	}else if ( end == null ){
		end = [e.latlng.lat,e.latlng.lng];
		endPoint = L.circle(L.latLng(end[0],end[1]),5,{color:'blue'}).addTo(map);
		//alert('route request:'+JSON.stringify(start)+':'+JSON.stringify(end));
		showRoute(start, end, enemies);
		
	}else{
		map.removeLayer(startPoint);
		map.removeLayer(endPoint);
		startPoint = null;
		endPoint = null;
		start = null;
		end = null;
		route_line.setLatLngs(dots2latlngs([]));
	} 
});


/**
* установка вражеских полков на карте по клику правой кнопки мыши
**/
map.on('contextmenu',function(e){
	enemies.push({lat:e.latlng.lat,lng:e.latlng.lng,radius:radius});
	setEnemy(e.latlng.lat,e.latlng.lng,radius);
});

/**
* преобразование массива точек в массив объектов latlng
**/
function dots2latlngs(dots){
	if (dots == null) return [];
	latlngs = new Array();
	for ( var i = 0; i < dots.length; i++ ) latlngs.push(L.latLng(dots[i][0],dots[i][1]));
	return latlngs;
}//end func

/**
* запрос у сервера и отображение на карте всех дорог
**/
function getAllRoads(){
	Ajax.sendRequest('GET','/allroads','a=1',function(r){
		//console.log(JSON.stringify(r));
		for ( var i = 0; i < r.length; i++ ){
			roads.push(L.polyline(dots2latlngs(r[i]),{color:'green'}).addTo(map));
		}
	});
}

/**
*  запрос у сервера и отображение на карте всех узлов
**/
function getAllNodes(){
	Ajax.sendRequest('GET','/allnodes','a=1',function(n){
		//console.log(JSON.stringify(n));
		for ( var i = 0; i < n.length; i++ ){
			nodes.push(L.circle(L.latLng(n[i][0],n[i][1]),5,{color:'yellow'}).addTo(map));
		}
	});
}

/**
* удаление с карты выведенных дорог
**/
function clearAllRoads(){
	while( roads.length != 0 ){
		map.removeLayer(roads[0]);
		delete roads[0];
		roads.splice(0,1);
	}
}

/**
* удаление с карты выведенных узлов
**/
function clearAllNodes(){
	while( nodes.length != 0 ){
		map.removeLayer(nodes[0]);
		delete nodes[0];
		nodes.splice(0,1);
	}
}

/**
* отображение на карте вражеских полков
**/
function setEnemy(lat,lng,radius){
	
	var k = 1;
	for ( var a = 0; a < 6.28; a += 0.01){
		enemyCircle.push(L.circle(L.latLng(lat+k*radius*Math.sin(a),lng+radius*Math.cos(a)),1,{color:'orange'}).addTo(map));
	} 
	
}

/**
* удаление полков врага и запрещенных узлов
**/
function deleteEnemies(){
	while ( enemyCircle.length != 0 ){
		map.removeLayer(enemyCircle[0]);
		delete enemyCircle[0];
		enemyCircle.splice(0,1);
	}
	while ( enemies.length != 0 ){
		delete enemies[0];
		enemies.splice(0,1);
	}
	while ( restr_nodes.length != 0 ){
		map.removeLayer(restr_nodes[0]);
		delete restr_nodes[0];
		restr_nodes.splice(0,1);
	}
}

/**
* запрос запрещенных узлов у сервера и отображение на карте
**/
function getRestrictedNodes(){
	var params = 'data='+JSON.stringify(enemies);
	Ajax.sendRequest('GET','/restricted',params,function(dots){
		for ( var i = 0; i < dots.length; i++ ){
			restr_nodes.push(L.circle(L.latLng(dots[i][0],dots[i][1]),5,{color:'#e67823'}).addTo(map));
		}
	});
}

/**
* запрос маршрута у сервера и отображение маршрута на карте
**/
function showRoute(start,end, enemies){
	route_line.setLatLngs(dots2latlngs([]));
	showElem(preloader);
	Time.start();
	Route.getRoute(start,end,enemies,function(route){
		hideElem(preloader);
		time.textContent = Time.stop() + ' мс';
		time.innerText = Time.stop() + ' мс';
		console.log(JSON.stringify(route));
		if ( route.length == 0 ){
			alert('Route not found');
		} 
		route_line.setLatLngs(dots2latlngs(route));
	});
}

/**
* показ элемента
**/
function showElem(el){
	el.style.display = 'inline-block';
}
/**
* скрытие элемента
**/
function hideElem(el){
	el.style.display = 'none';
}