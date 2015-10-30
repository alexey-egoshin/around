/**объект для получения маршрута**/
var Route =
{
	/** возможные варианты: 'osrm','google','spatialite_query','spatialite_dijkstra',
	* 'spatialite_dijkstra3','spatialite_dijkstra_enemy','spatialite_routebypassingwide',
	* 'spatialite_routewave','spatialite_routebypassingwideenemy','spatialite_routewaveenemy'
	**/
	service: 'spatialite_query', 
    
	/**объект directionsService**/
    directionsService: new google.maps.DirectionsService(),
	
	/**получение маршрута с различных сервисов
    * @param start, end точки начала и конца пути, представленные как объекты {lat:lat, lng:lng, radius:radius}
	* @param enemies массив полков неприятеля вида [{lat:lat, lng:lng, radius:radius}, ...]
    * @param callback объект в который передается маршрут в виде массива точек и объект полка
    **/
    getRoute: function(start,end,enemies,callback){
        if ( Route.service == 'google' ){
            Route.getRouteGoogle(start,end,callback);
        }else if ( Route.service == 'spatialite_query'  ){
            Route.getRouteSpatialiteQuery(start,end,callback);
	}
	else if(Route.service == 'spatialite_query_db_only' ){
	    Route.getRouteSpatialiteQueryDbOnly(start,end,callback);
	}else if ( Route.service == 'osrm' ){
            Route.getRouteOSRM(start,end,callback);
        }else if ( Route.service == 'spatialite_dijkstra' ){
            Route.getRouteSpatialiteDijkstra(start,end,callback);
        }else if ( Route.service == 'spatialite_dijkstra3' ){
            Route.getRouteSpatialiteDijkstra3(start,end,callback);
        }else if( Route.service == 'spatialite_dijkstra_enemy' ){
		Route.getRouteSpatialiteDijkstraEnemy(start,end,enemies,callback);
	}else if( Route.service == 'spatialite_routebypassingwide' ){
		Route.getRouteSpatialitebypassingWide(start,end,callback);
	}else if( Route.service == 'spatialite_routewave' ){
		Route.getRouteSpatialiterouteWave(start,end,callback);
	}else if( Route.service == 'spatialite_routebypassingwideenemy' ){
		Route.getRouteSpatialitebypassingWideEnemy(start,end,enemies,callback);
	}else if( Route.service == 'spatialite_routewaveenemy' ){
		Route.getRouteSpatialiterouteWaveEnemy(start,end,enemies,callback);
	}else if( Route.service == 'spatialite_findroutetobase' ){
		Route.getRouteSpatialiteFindRouteToBase(start,end,enemies,callback);
	}
	else{
            Route.getRouteSpatialiteQuery(start,end,callback);
        }
    },
    
    /**получение маршрута с сервиса маршрутов Google через JS API
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback объект в который передается маршрут в виде массива точек и объект полка
    **/
	getRouteGoogle: function(start,end,callback){
		console.log(JSON.stringify(start)+":"+JSON.stringify(end));
		var from = new google.maps.LatLng(start.lat, start.lng);
		var to = new google.maps.LatLng(end.lat, end.lng);
		var request = {
					  origin: from,
					  destination: to,
					  //задание путевой точки
					  //waypoints: [{location: new google.maps.LatLng(56.64,47.82 ), stopover: false}],
					  travelMode: google.maps.TravelMode.DRIVING
					};
		Route.directionsService.route(request, function(response, status) {
			if (status == google.maps.DirectionsStatus.OK) {
				var points = response.routes[0].overview_path;
				console.log(JSON.stringify(response));
                var liters = [];
                for ( var key in points[0]){
                    liters.push(key);
                    if (liters.length >1 ) break;  
                }
                console.log(liters);
                var route = [];
    			for ( var i = 0; i < points.length; i++ ){
    				route.push([points[i][liters[0]],points[i][liters[1]]]);
    			}
                callback(route);
			}
		});
	},
	
	/**
    * получение маршрута от модуля OSRM
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteOSRM: function(start,end,callback){
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		Ajax.sendRequest('GET', '/routeosrm', params, function(route) {
			console.log(JSON.stringify(route));
            callback(route);
		});
	},
    
    
    /**
    * получение маршрута от модуля Spatialite метод routeQuery
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteQuery: function(start,end,callback){
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routequery', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	
    /**
    * получение маршрута от модуля Spatialite метод routeQueryDbOnly с определение id узлов через запрос к базе
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteQueryDbOnly: function(start,end,callback){
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routequery_db_only', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
    
    /**
    * получение маршрута от модуля Spatialite метод routeDijkstra
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteDijkstra: function(start,end,callback){
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routedijkstra', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута избегая позиций под боем противника от модуля Spatialite метод routeDijkstraEnemy 
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
	* @param enemies массив полков неприятеля вида [{lat:lat, lng:lng, radius:radius}, ...]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteDijkstraEnemy: function(start,end,enemies,callback){
		console.log(enemies);
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end])+'&enemy='+JSON.stringify(enemies);
		console.log(params);
		Ajax.sendRequest('GET', '/routedijkstraenemy', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута избегая позиций под боем противника от модуля Spatialite метод bypassingWideEnemy 
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
	* @param enemies массив полков неприятеля вида [{lat:lat, lng:lng, radius:radius}, ...]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialitebypassingWideEnemy: function(start,end,enemies,callback){
		console.log(enemies);
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end])+'&enemy='+JSON.stringify(enemies);
		console.log(params);
		Ajax.sendRequest('GET', '/routebypassingwideenemy', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута от модуля Spatialite метод bypassingWide'
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialitebypassingWide: function(start,end,callback){
		console.log(enemies);
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routebypassingwide', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута от модуля Spatialite метод routeWave'
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiterouteWave: function(start,end,callback){
		console.log(enemies);
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routewave', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута от модуля Spatialite метод routeWaveEnemy'
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
	* @param enemies массив полков неприятеля вида [{lat:lat, lng:lng, radius:radius}, ...]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiterouteWaveEnemy: function(start,end,enemies,callback){
		console.log(enemies);
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end])+'&enemy='+JSON.stringify(enemies);
		console.log(params);
		Ajax.sendRequest('GET', '/routewaveenemy', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута от модуля Spatialite метод findRouteToBase'
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
	* @param enemies массив полков неприятеля вида [{lat:lat, lng:lng, radius:radius}, ...]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteFindRouteToBase: function(start,end,enemies,callback){
		console.log(enemies);
		var params = 'data=' + JSON.stringify([start,end])+'&enemy='+JSON.stringify(enemies);
		console.log(params);
		Ajax.sendRequest('GET', '/findroutetobase', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	
	/**
    * получение маршрута от модуля Spatialite метод routeDijkstra3
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getRouteSpatialiteDijkstra3: function(start,end,callback){
		var start = [start.lat, start.lng];
		var end = [end.lat, end.lng];
		var params = 'data=' + JSON.stringify([start,end]);
		console.log(params);
		Ajax.sendRequest('GET', '/routedijkstra3', params, function(route) {
			//console.log(JSON.stringify(route));
            callback(route);
		});
	},
	
	/**
    * получение маршрута от модуля Spatialite метод routeDijkstra3
    * @param start, end точки начала и конца пути, представленные как массивы [lat,lng]
    * @param callback функция обратного вызова в которую передается маршрут и объект полка
    **/
    
    getNotConnectedRoads: function(start, callback){
		var start = [start.lat, start.lng];
		var params = 'data=' + JSON.stringify([start]);
		console.log(params);
		Ajax.sendRequest('GET', '/findnotconnected', params, function(result) {
			//console.log(JSON.stringify(result));
            callback(result);
		});
	}
    
}