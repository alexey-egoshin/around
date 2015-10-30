var start = null; //объект стартовой точки
var end = null; //объект конечной точки
var startPoint = null; //круг начальной точки
var endPoint = null; //круг конечной точки
var route_line = L.polyline([],{color:'blue'}).addTo(map);
var roads = []; //массив полилиний для дорог
var nodes = []; //массив точек для узлов
var enemies = []; //массив объектов вражеских полков
var enemyCircle = []; //массив кругов вражеских полков
var radius = 0.01; //радиус действия полка
var restr_nodes = []; //массив кругов запрещенных узлов
var readySpatialite = false //флаг готовности модуля spatialite
var zoom = 13; //масштаб карты

/**
* установка начальной и конечной точек на карте
**/
map.on('click',function(e){
	if (getRadio() == 'route'){
		if ( start == null ){
			start = {lat:e.latlng.lat, lng:e.latlng.lng, radius:radius};
			//startPoint = L.circle(L.latLng(start.lat,start.lng),5,{color:'red'}).addTo(map);
			startPoint = L.marker(L.latLng(start.lat,start.lng), {draggable:true}).addTo(map);
			startPoint.on('dragend',function(e){
				start.lat = startPoint.getLatLng().lat;
				start.lng = startPoint.getLatLng().lng;
				showRoute(start, end, enemies);
			});
		}else if ( end == null ){
			end = {lat:e.latlng.lat, lng:e.latlng.lng, radius:radius};
			//endPoint = L.circle(L.latLng(end.lat,end.lng),5,{color:'blue'}).addTo(map);
			//alert('route request:'+JSON.stringify(start)+':'+JSON.stringify(end));
			endPoint = L.marker(L.latLng(end.lat,end.lng), { draggable:true}).addTo(map);
			endPoint.on('dragend',function(e){
				end.lat = endPoint.getLatLng().lat;
				end.lng = endPoint.getLatLng().lng;
				showRoute(start, end, enemies);
			});
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
	}else{
		start = null;
		end = null;
		route_line.setLatLngs(dots2latlngs([]));
		if ( startPoint != null ) map.removeLayer(startPoint);
		if ( endPoint != null ) map.removeLayer(endPoint);
		start = {lat:e.latlng.lat, lng:e.latlng.lng, radius:radius};
		startPoint = L.marker(L.latLng(start.lat,start.lng), {draggable:true}).addTo(map);
		clearAllNodes();
		clearAllRoads();
		showNotConnected(start);
		startPoint.on('dragend',function(e){
			start.lat = startPoint.getLatLng().lat;
			start.lng = startPoint.getLatLng().lng;
			showNotConnected(start);
		});
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
	
	enemyCircle.push(L.circle([lat,lng], radius * 111300, {color: '#f03', fillColor: '#f03', opacity: 0.1,fillOpacity:0.1 }).addTo(map));
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
	if (!readySpatialite){
		alert('Модуль spatialite не готов!');
		return;
	}
	route_line.setLatLngs(dots2latlngs([]));
	showElem(preloader);
	Time.start();
	Route.getRoute(start,end,enemies,function(route){
		var timeStop = Time.stop();
		time.textContent = timeStop + ' мс';
		time.innerText = timeStop + ' мс';
		console.log(JSON.stringify(route));
		hideElem(preloader);
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

/**
* инициализация модуля spatialite
**/
function initSpatialite(file){
	readySpatialite = false;
	showElem(preloader);
	var params = 'file=' + file;
	Ajax.sendRequest('GET','/init',params,function(result){
		hideElem(preloader);
		readySpatialite = true;
		console.log(JSON.stringify(result));
		var center = mapCenter[result.file];
		map.setView(center, zoom);
	});
}

/**
* объект содержащий центры карты для разных регионов
**/
var mapCenter = 
{
	"RU-ME.osm.sqlite": [56.605, 47.9],
	"iraq-latest.osm.sqlite": [33.385586,44.373779],
	"vietnam-latest.osm.sqlite": [21.0845,105.820313],
	"syria-latest.osm.sqlite": [33.504759,36.496582],
	"tajikistan-latest.osm.sqlite": [38.548165,68.774414],
	"RU-LEN.osm.sqlite": [59.95501,30.311279],
	"RU-MOS.osm.sqlite": [55.751077,37.621307],
	"israel-and-palestine-latest.osm.sqlite": [31.984255, 35.004911],
	"kosovo-latest.osm.sqlite": [42.614833, 20.893836],
	"mongolia-latest.osm.sqlite": [47.773702, 106.427558],
	"pakistan-latest.osm.sqlite": [30.183729, 71.509366],
	"ukraine-latest.osm.sqlite": [50.350146, 30.633554]
};

/**
* Получение значение радио переключателя вида задачи
* @return значение
**/
function getRadio(){
    var inputs = document.getElementsByTagName('input');
    for ( var i = 0; i < inputs.length; i++ ){
        if ( inputs[i].attributes.name.value == 'task' )
            if ( inputs[i].attributes.type.value == 'radio' )
                if( inputs[i].checked ) return inputs[i].value;
    }
    return null;
}

/**
* проверка связности графа волновым методом
* вывод несвязной части графа путей
* @param start начальная точка распостранения волны {lat:lat, lng:lng, radius:radius}
**/
function showNotConnected(start){
	if (!readySpatialite){
		alert('Модуль spatialite не готов!');
		return;
	}
	showElem(preloader);
	Time.start();
	Route.getNotConnectedRoads(start, function(result){
		hideElem(preloader);
		time.textContent = Time.stop() + ' мс';
		time.innerText = Time.stop() + ' мс';
		//console.log(JSON.stringify(result));
		if ( result == null ){
			alert('Result fail');
		}
		for ( var i = 0; i < result.length; i++ ){
			roads.push(L.polyline(dots2latlngs(result[i]),{color:'green'}).addTo(map));
		}
	})
}
