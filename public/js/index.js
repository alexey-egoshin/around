window.onload = function(){
    
	var selectService = document.getElementById('service');
	Route.service = selectService.value;
	selectService.onchange = function(){
		Route.service = selectService.value;
		if ( start != null && end != null ){
			showRoute(start, end, enemies);
		}
	};
	
	var btnAllRoadsOn = false;
	var btnAllNodesOn = false;
	var btnAllRoads = document.getElementById('all-roads');
	var btnAllNodes = document.getElementById('all-nodes');
	var btnDelEnemy = document.getElementById('del-enemies');
	var btnGetRestr = document.getElementById('get-restr');
	var preloader = document.getElementById('preloader');
	var time = document.getElementById('time');
	btnAllRoads.onclick = function(){
		if ( btnAllRoadsOn ){
			btnAllRoadsOn = false;
			btnAllRoads.style.color = 'black';
			clearAllRoads();
		}else{
			btnAllRoads.style.color = 'red';
			btnAllRoadsOn = true;
			getAllRoads();
		}
	};
	btnAllNodes.onclick = function(){
		if ( btnAllNodesOn ){
			btnAllNodesOn = false;
			btnAllNodes.style.color = 'black';
			clearAllNodes();
		}else{
			btnAllNodes.style.color = 'red';
			btnAllNodesOn = true;
			getAllNodes();
		}
	};
	
	btnDelEnemy.onclick = function(){
		deleteEnemies();
	};
	
	btnGetRestr.onclick = function(){
		getRestrictedNodes();
	};
};	