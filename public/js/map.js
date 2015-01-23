    //создаем карту
	var mapCenter = [56.605, 47.9];
	var zoom = 13;
	var maxZoom = 18;
	var id = 'examples.map-i86knfo3';
	var map = null;


	map = L.map('map-block').setView( mapCenter, zoom );

	//создаем tile-слой и добавляем его на карту 
	var mapbox = L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
		maxZoom: maxZoom,
		attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
			'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
			'Imagery © <a href="http://mapbox.com">Mapbox</a>',
		id: id
	});
	
	//создаем другие базовые слои от других провайдеров     
	var osmde = L.tileLayer.provider('OpenStreetMap.DE');
	var osmBW = L.tileLayer.provider('OpenStreetMap.BlackAndWhite').addTo(map);
	var ersiwi = L.tileLayer.provider('Esri.WorldImagery');
	//создаем контрол для переключения слоев
	var baseLayers = 	{
							"OpenStreetMap": osmde,
                            "Mapbox": mapbox,
							"OpenStreetMap Black and White": osmBW,
							'Esri WorldImagery': ersiwi
						};

	L.control.layers(baseLayers).addTo(map);