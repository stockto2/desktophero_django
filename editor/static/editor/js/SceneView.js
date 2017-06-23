function SceneView(){
	this.scene;
	this.camera;
	this.renderer;
	this.guiControls;

	this.hemi;
	this.SCREEN_WIDTH;
	this.SCREEN_HEIGHT;

	this.loader;
	this.exporter = new THREE.STLExporter();

	this.cubeMap;

	this.selectedMesh;
	this.meshes = []; // Keep track of all meshes added to scene

	this.futureMeshToSelect = null;
	this.futureBoneGroupToAttach = null;
	this.futureBoneGroupAddDefaultMesh = null;

	this.skeletonHelpers = [];

	this.boneHandles = [];
	this.selectedBone;
	this.editMode = 'none';
	this.rotationBoneOrigin;
	this.editMouseOriginX;
	this.editMouseOriginY;

	this.mouseX;
	this.mouseY;
	this.rightMouseDownXY;

	this.raycaster = new THREE.Raycaster();

	this.X_AXIS = new THREE.Vector3(1,0,0);
	this.Y_AXIS = new THREE.Vector3(0,1,0);
	this.Z_AXIS = new THREE.Vector3(0,0,1);

	this.boneAxisHelper;

	this.meshPickingView = new PickingView();

	this.addModelListeners();
}
	function init(){
		var self = this;
		this.scene = new THREE.Scene();

		this.camera =  new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.001, 500);
		this.renderer = new THREE.WebGLRenderer({
													antialias:true,
													preserveDrawingBuffer   : true   // required to support .toDataURL()
												});
		
		this.renderer.setClearColor(0x000033);
		this.renderer.setSize(500, 500);
		this.renderer.shadowMapEnabled= true;
		this.renderer.shadowMapSoft = true;

		this.renderer.shadowMapType = THREE.PCFSoftShadowMap;
		this.renderer.setPixelRatio( window.devicePixelRatio );
		window.addEventListener( 'resize', function(){
			self.onWindowResize();
		} false );
		editor_panel = document.getElementById('editor_panel');
		editor_panel.appendChild(this.renderer.domElement);
		this.onWindowResize();
		
		this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
		this.controls.addEventListener('change', this.render.bind(this));
					
		this.camera.position.x = 0;
		this.camera.position.y = 0;
		this.camera.position.z = 12;
		this.camera.lookAt(this.scene.position);

		this.cubeMap = new THREE.CubeTextureLoader()
				.setPath(window.location.origin + '/static/editor/images/cubemaps/hill/')
				.load(['posx.png', 'negx.png', 'posz.png', 'negz.png', 'posy.png', 'negy.png']);
		this.cubeMap.format = THREE.RGBFormat;
		this.scene.background = this.cubeMap;

		materials.metallic = Materials.createReflectiveMaterial(new THREE.Color(0.75, 0.75, 0.7), .3, this.cubeMap);
		materials.selected = Materials.createReflectiveMaterial(new THREE.Color(0.7, .8, .9), .2, this.cubeMap);
		materials.boneGroupSelected = Materials.createReflectiveMaterial(new THREE.Color(0.9, .8, .6), .2, this.cubeMap);
		materials.clay = Materials.createReflectiveMaterial(new THREE.Color(0.5, 0.4, 0.5), 0.02, this.cubeMap);
		materials.default = materials.metallic;

		this.boneAxisHelper = new THREE.AxisHelper(10);
		this.scene.add(this.boneAxisHelper);
		this.boneAxisHelper.visible = false;

		this.initLights();

		//this.populateTabs();
		this.libraryPopulatePoses();
		this.libraryPopulateBoneGroups();

		this.hideLibraries();
		this.hideInfoPanels();

		this.setMode('mesh');
	}

	function onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		var editor_panel = document.getElementById('editor_panel');
		this.renderer.setSize(editor_panel.offsetWidth, editor_panel.offsetHeight );
	}

	function initLights(){
		this.ambientLight = new THREE.AmbientLight(0x555555);
		this.scene.add(this.ambientLight);

		var pointLight = new THREE.SpotLight(0xffffff);
		pointLight.position.y = 10;
		pointLight.position.z = 20;
		pointLight.position.x = -5;
		pointLight.castShadow = true;
		pointLight.intensity = 0.75;
		this.scene.add(pointLight);

		var pointLight2 = new THREE.SpotLight(0xffffdd);
		pointLight2.position.y = 60;
		pointLight2.position.z = -40;
		pointLight2.position.x = 20;
		pointLight2.castShadow = true;
		this.scene.add(pointLight2);

		var pointLight3 = new THREE.SpotLight(0xffffdd);
		pointLight3.position.y = 10;
		pointLight3.position.z = 40;
		pointLight3.position.x = -20;
		pointLight3.castShadow = true;
		pointLight.intensity = 0.15;
		this.scene.add(pointLight3);

		lightHelper = new THREE.Mesh( new THREE.SphereBufferGeometry(4, 8, 8), new THREE.MeshBasicMaterial({color: 0x00ff00}));
		lightHelper.position.x = pointLight2.position.x;
		lightHelper.position.y = pointLight2.position.y;
		lightHelper.position.z = pointLight2.position.z;
		//this.scene.add(lightHelper);
	}

	function exportToSTL(){
		var stlString = this.exporter.parse(this.scene);
		var blob = new Blob([stlString], {type: 'text/plain'});
		
		FileSaver.download(blob, model.character.getName() + '.stl');
	}

	function render(){

		for (var i = 0; i < this.boneHandles.length; i++){
			var boneHandle = this.boneHandles[i];
			var boneGroupUid = boneHandle.boneGroupUid;
			var boneIndex = boneHandle.boneIndex;

			var boneGroup = character.boneGroups.get(boneGroupUid);
			var bone = boneGroup.skeleton.bones[boneIndex];

			var globalBonePosition = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);

			boneHandle.position.x = globalBonePosition.x;
			boneHandle.position.y = globalBonePosition.y;
			boneHandle.position.z = globalBonePosition.z;
		}

		if (this.selectedBone != null){
			var position = new THREE.Vector3();
			var quaternion = new THREE.Quaternion();
			var scale = new THREE.Vector3();
			this.selectedBone.matrixWorld.decompose(position, quaternion, scale);
			this.boneAxisHelper.position.set(position.x, position.y, position.z);
			//this.boneAxisHelper.rotation.setFromQuaternion(quaternion);




			/*var axisClone = this.X_AXIS.clone();
			this.boneAxisHelper.rotation.setFromVector3(this.selectedBone.parent.getWorldRotation());
			axisClone.applyEuler(this.selectedBone.rotation)
			this.boneAxisHelper.rotation.setFromVector3(axisClone);*/
		}
	}

	function animate(){
		requestAnimationFrame(this.animate.bind(this));
		for (var i = 0; i < this.skeletonHelpers.length; i++){
			this.skeletonHelpers[i].update();
		}
		this.render();
		if (this.mode == 'mesh picking'){
			this.renderer.render(this.meshPickingView.scene, this.camera);
		} else if (this.mode == 'mesh' || this.mode == 'bone' || this.mode == 'pose' || this.mode == 'preset' || this.mode == 'character') {
			this.renderer.render(this.scene, this.camera);
		}
	}

	/*function resize(innerWidth, innerHeight){
		this.SCREEN_WIDTH = window.innerWidth;
		this.SCREEN_HEIGHT = window.innerHeight;
		this.camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
	}*/

	function addModelListeners(){
		character.boneGroups.itemAddedEvent.addListener(this, this.onBoneGroupAdded);
		character.boneGroups.itemRemovedEvent.addListener(this, this.onBoneGroupRemoved);
	}

	function selectMesh(mesh){
		// If waiting for a mesh to be selected when load, cancel it
		if (this.futureMeshToSelect != null){
			this.futureMeshToSelect = null;
		}

		// reset previously selected mesh to normal material
		if (this.selectedMesh != null){
			this.selectedMesh.material = model.materials['default'];
		}

		this.selectedMesh = mesh;

		// if (this.selectedMesh == null){
		// 	document.getElementById("mesh-help").hidden = false;
		// } else {
		// 	document.getElementById("mesh-help").hidden = true;
		// 	this.selectedMesh.material = model.materials['selected'];
		// }

		if (this.selectedMesh == null){
			// Update mesh info label
			this.hideInfoPanel("mesh");
		} else {
			// Update mesh info label
			this.showInfoPanel('mesh');

			// document.getElementById("mesh-info-name").innerText = this.selectedMesh.name;
			// var boneGroupName = model.character.boneGroups.get(mesh.boneGroupUid).name;
			// document.getElementById("mesh-info-attached-to").innerText = boneGroupName;
		}
	}

	function showInfoPanel(panelName){
		this.hideInfoPanels();

		// if (panelName == 'mesh'){
		// 	var meshInfoPanel = document.getElementById("mesh-info");
		// 	meshInfoPanel.hidden = false;
		// } else if (panelName == 'bone'){
		// 	var boneInfoPanel = document.getElementById("bone-info");
		// 	boneInfoPanel.hidden = false;
		// } else if (panelName == 'preset'){
		// 	var presetInfoPanel = document.getElementById("preset-info");
		// 	presetInfoPanel.hidden = false;
		// } else if (panelName == 'character'){
		// 	var characterInfoPanel = document.getElementById("character-info");
		// 	characterInfoPanel.hidden = false;
		// } else if (panelName == 'pose'){
		// 	document.getElementById("pose-info").hidden = false;
		// }
	}

	function hideInfoPanel(panelName){
		// if (panelName == 'mesh'){
		// 	var meshInfoPanel = document.getElementById("mesh-info");
		// 	meshInfoPanel.hidden = true;
		// } else if (panelName == 'bone'){
		// 	var boneInfoPanel = document.getElementById("bone-info");
		// 	boneInfoPanel.hidden = true;
		// } else if (panelName == 'preset'){
		// 	var presetInfoPanel = document.getElementById("preset-info");
		// 	presetInfoPanel.hidden = true;
		// } else if (panelName == 'character'){
		// 	var characterInfoPanel = document.getElementById("character-info");
		// 	characterInfoPanel.hidden = true;
		// } else if (panelName == 'pose'){
		// 	document.getElementById("pose-info").hidden = true;
		// }
	}

	function hideInfoPanels(){
		// var meshInfoPanel = document.getElementById("mesh-info");
		// meshInfoPanel.hidden = true;
		// var boneInfoPanel = document.getElementById("bone-info");
		// boneInfoPanel.hidden = true;
		// var presetInfoPanel = document.getElementById("preset-info");
		// presetInfoPanel.hidden = true;
		// var characterInfoPanel = document.getElementById("character-info");
		// characterInfoPanel.hidden = true;
		// document.getElementById("pose-info").hidden = true;
	}

	function selectBoneGroup(boneGroup){
		// If waiting for a bone group to be to be attached on load, cancel it
		if (this.futureBoneGroupToAttach != null){
			this.futureBoneGroupToAttach = null;
		}

		// reset previously selected bone group to normal material
		if (this.selectedBoneGroup != null){
			for (var meshId in this.selectedBoneGroup.meshes.dict){
				var mesh = this.selectedBoneGroup.meshes.get(meshId);
				mesh.material = model.materials['default'];
			}
		}
		
		this.selectedBoneGroup = boneGroup;

		if (this.selectedBoneGroup == null){
			if (this.mode == 'bone'){
				this.hideInfoPanel('bone');
				// document.getElementById("bone-help").hidden = false;
			}
		} else {
			// document.getElementById("bone-help").hidden = true;
			for (var meshId in this.selectedBoneGroup.meshes.dict){
				var mesh = this.selectedBoneGroup.meshes.get(meshId);
				mesh.material = model.materials['boneGroupSelected'];
			}

			// Update info panel
			// document.getElementById("bone-info-name").innerText = this.selectedBoneGroup.name;
			var attachedToName = model.character.boneGroups.get(this.selectedBoneGroup.parentBoneGroupUid).name;
			// document.getElementById("bone-info-attached-to").innerText = attachedToName;
			this.showInfoPanel('bone');
		}
	}

	function selectMeshFuture(boneGroupUid, meshName){
		this.futureMeshToSelect = [boneGroupUid, meshName];
	}

	function attachBoneGroupFuture(boneGroupName, toBoneGroupUid, attachPoint){
		this.futureBoneGroupToAttach = [boneGroupName, toBoneGroupUid, attachPoint];
	}

	function addDefaultMeshFuture(boneGroupName){
		this.futureBoneGroupAddDefaultMesh = boneGroupName;
	}

	function onBoneGroupAdded(character, boneGroupUid){
		var boneGroup = character.boneGroups.get(boneGroupUid);
		boneGroup.meshes.itemAddedEvent.addListener(this, this.onMeshAdded);
		boneGroup.meshes.itemRemovedEvent.addListener(this, this.onMeshRemoved);
		boneGroup.attachedEvent.addListener(this, this.onBoneGroupAttached);
		boneGroup.unattachedEvent.addListener(this, this.onBoneGroupUnattached);

		var randomColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16);
		for (var i = 0; i < boneGroup.skeleton.bones.length; i++){
			var bone = boneGroup.skeleton.bones[i];

			if (bone.name.startsWith("#")){
				continue;
			}

			var boneHandle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 5), new THREE.MeshBasicMaterial({color: randomColor, wireframe: true}));
			boneHandle.boneGroupUid = boneGroupUid;
			boneHandle.boneIndex = i;
			boneHandle.includeInExport = false;
			this.boneHandles.push(boneHandle);

			boneHandle.visible = (this.mode == 'pose');
			this.scene.add(boneHandle);
		}

		// Are we waiting for this bone group to be loaded so we can attach it?
		if (this.futureBoneGroupToAttach !== null &&
				boneGroup.name === this.futureBoneGroupToAttach[0]){
			var toBoneGroupUid = this.futureBoneGroupToAttach[1];
			var attachPoint = this.futureBoneGroupToAttach[2];
			
			model.attachBoneGroup(boneGroup.uid, toBoneGroupUid, attachPoint);

			this.futureBoneGroupToAttach = null;
		}

		if (this.futureBoneGroupAddDefaultMesh !== null &&
				boneGroup.name === this.futureBoneGroupAddDefaultMesh){
			addMesh(boneGroup.uid, boneGroup.libraryName, "box");
			this.futureBoneGroupAddDefaultMesh = null;
		}

		//this.meshesTabAddBoneGroup(boneGroupUid, boneGroup.name);
		//this.poseTabAddBoneGroup(boneGroupUid, boneGroupName);
		//this.boneGroupsTabAddBoneGroup(boneGroupUid, boneGroup.name);

		/*for (var meshId in boneGroup.meshes.dict){
			//TODO: add icon as well.
			this.meshesTabAddMesh(boneGroupUid, meshId, "stuff.png");
		}*/
	}

	function onBoneGroupRemoved(character, boneGroupUid){
		console.log("Bone group removed!");

		// Remove meshes that were attached to that bone group


		// Remove from three.js scene
		var boneGroupsToRemove = [];
		for (var i in this.scene.children){
			var sceneElement = this.scene.children[i];
			if (sceneElement.boneGroupUid === boneGroupUid){
				boneGroupsToRemove.push(sceneElement);
			}
		}
		for (var i in boneGroupsToRemove){
			var element = boneGroupsToRemove[i];
			this.scene.remove(element);
		}

		// Remove boneHandle entries.
		var toRemove = [];
		for (var i = 0; i < this.boneHandles.length; i++){
			if (this.boneHandles[i].boneGroupUid === boneGroupUid){
				toRemove.push(i);
			}
		}
		for (var i = toRemove.length - 1; i >= 0; i--){ // Go backwards so we don't mess up the indices when we're removing elements.
			var index = toRemove[i];
			this.boneHandles.splice(index, 1);
		}
	}

	function onBoneGroupAttached(boneGroup, attachedToUid){
		/*var boneGroupAttachedTo = model.character.boneGroups.get(attachedToUid);
		var labelId = boneGroup.uid + "-bone-attach-label";
		var label = document.getElementById(labelId);
		label.innerText = 'Attached to: ' + boneGroupAttachedTo.name;*/
	}

	function onBoneGroupUnattached(boneGroup){
		var labelId = boneGroup.uid + "-bone-attach-label";
		// var label = document.getElementById(labelId);
		label.innerText = 'Attached to: None';
	}

	function onMeshAdded(boneGroup, meshId){
		console.log("Mesh " + meshId + " added to bone group " + boneGroup.name + ".");

		var mesh = boneGroup.meshes.get(meshId);
		mesh.boneGroupUid = boneGroup.uid;
		this.scene.add(mesh);

		var skeletonHelper = new THREE.SkeletonHelper(mesh);
		skeletonHelper.material.linewidth = 4;
		skeletonHelper.meshId = meshId;
		skeletonHelper.visible = (this.mode == 'pose');
		this.skeletonHelpers.push(skeletonHelper);
		this.scene.add(skeletonHelper);

		this.meshes.push(mesh);

		//this.meshesTabAddMesh(boneGroup.uid, meshId, "stuff.png");

		// Are we waiting for this mesh to be loaded so we can select it?
		if (this.futureMeshToSelect !== null &&
				boneGroup.uid === this.futureMeshToSelect[0] &&
				mesh.name === this.futureMeshToSelect[1]){
			this.selectMesh(mesh);
			this.futureMeshToSelect = null;
		}
	}

	function onMeshRemoved(boneGroup, meshId){
		console.log("Mesh " + meshId + " removed from bone group " + boneGroup.name + ".");

		// Remove mesh and skeletonhelper from scene
		var toRemove = [];
		for (var i in this.scene.children){
			var sceneElement = this.scene.children[i];
			if (sceneElement.uid == meshId){
				toRemove.push(sceneElement);
			}
		}
		for (var i = toRemove.length - 1; i >= 0; i--){ // Go backwards so we don't mess up the indices when we're removing elements.
			var element = toRemove[i];
			this.scene.remove(element);
		}

		// Remove mesh from this.meshes
		toRemove = [];
		for (var i in this.meshes){
			var mesh = this.meshes[i];
			if (mesh.uid == meshId){
				toRemove.push(i)
				break;
			}
		}
		for (var i = toRemove.length - 1; i >= 0; i--){ // Go backwards so we don't mess up the indices when we're removing elements.
			var index = toRemove[i];
			this.meshes.splice(index, 1);
		}

		// Remove skeletonHelper entries.
		var toRemove = []; 
		for (var i = 0; i < this.skeletonHelpers.length; i++){
			if (this.skeletonHelpers[i].meshId == meshId){
				toRemove.push(i);
			}
		}
		for (var i = toRemove.length - 1; i >= 0; i--){ // Go backwards so we don't mess up the indices when we're removing elements.
			var index = toRemove[i];
			this.skeletonHelpers.splice(index, 1);
		}

		//this.meshesTabRemoveMesh(boneGroup.uid, meshId);
	}

	function setMode(mode){
		// Hide/show bone handles
		var showBoneHandles = (mode == 'pose');
		for (var i = 0; i < this.boneHandles.length; i++){
			this.boneHandles[i].visible = showBoneHandles;
		}
		for (var i = 0; i < this.skeletonHelpers.length; i++){
			this.skeletonHelpers[i].visible = showBoneHandles;
		}
		this.boneAxisHelper.visible = showBoneHandles;
	}

	function startBoneRotate(){
		if (this.selectedBone === null){
			return;
		}

		console.log("Entering rotate mode.");
		this.editMode = 'rotate';
		this.initialRotation = this.selectedBone.rotation.clone();
		this.editAxis = null;

		this.editMouseOriginX = this.mouseX;
		this.editMouseOriginY = this.mouseY;
	}

	function startBoneMove(){
		if (this.selectedBone === null){
			return;
		}

		console.log("Entering move mode.");
		this.editMode = 'move';
		this.initialPosition = this.selectedBone.position.clone();
		this.editAxis = null;

		this.editMouseOriginX = this.mouseX;
		this.editMouseOriginY = this.mouseY;
	}

	function startBoneScale(){
		if (this.selectedBone === null){
			return;
		}

		console.log("Entering scale mode.");
		this.editMode = 'scale';
		this.initialScale = this.selectedBone.scale.clone();
		this.editAxis = null;

		this.editMouseOriginX = this.mouseX;
		this.editMouseOriginY = this.mouseY;
	}

	function finalizeEdit(){
		this.editMode = 'none';
	}

	function cancelBoneRotate(){
		console.log("Cancelling bone rotate.");
		this.selectedBone.rotation.setFromVector3(this.initialRotation);
		this.editMode = 'none';
	}

	function cancelBoneMove(){
		console.log("Cancelling bone move.");
		this.selectedBone.position.x = this.initialPosition.x;
		this.selectedBone.position.y = this.initialPosition.y;
		this.selectedBone.position.z = this.initialPosition.z;
		this.editMode = 'none';
	}

	function cancelBoneScale(){
		console.log("Cancelling bone scale.");
		this.selectedBone.scale.x = this.initialScale.x;
		this.selectedBone.scale.y = this.initialScale.y;
		this.selectedBone.scale.z = this.initialScale.z;

		this.editMode = 'none';
	}

	function setEditAxis(axis){
		if (this.editMode === 'rotate'){
			this.selectedBone.rotation.setFromVector3(this.initialRotation);
		} else if (this.editMode === 'move'){
			this.selectedBone.position.x = this.initialPosition.x;
			this.selectedBone.position.y = this.initialPosition.y;
			this.selectedBone.position.z = this.initialPosition.z;
		} else if (this.editMode === 'scale'){
			this.selectedBone.scale.x = this.initialScale.x;
			this.selectedBone.scale.y = this.initialScale.y;
			this.selectedBone.scale.z = this.initialScale.z;
		} else {
			console.error("Cannot set edit axis, not in any edit mode.");
			return;
		}

		if (axis == 'X' || axis == 'x'){
			this.editAxis = 'X';
		} else if (axis == 'Y' || axis == 'y'){
			this.editAxis = 'Y';
		} else if (axis == 'Z' || axis == 'z'){
			this.editAxis = 'Z';
		}
		console.log("Edit axis set to " + this.editAxis + ".");
	}

	function getClickVector(mouseX, mouseY, camera){
		var vector = new THREE.Vector3(
			( mouseX / window.innerWidth ) * 2 - 1,
		  - ( mouseY / window.innerHeight ) * 2 + 1,
			0.5
		);
		vector.unproject(camera);
		return vector;
	}

	function onLeftMouseDown(mouseX, mouseY){
		if (this.editMode !== 'none'){
			this.finalizeEdit();
			return;
		}
	}

	function onLeftMouseUp(mouseX, mouseY){

	}

	function onRightMouseDown(mouseX, mouseY){
		this.rightMouseDownXY = [mouseX, mouseY];

		if (this.editMode === 'rotate'){
			this.cancelBoneRotate();
			return;
		} else if (this.editMode === 'move'){
			this.cancelBoneMove();
			return;
		} else if (this.editMode === 'scale'){
			this.cancelBoneScale();
			return;
		}
	}

	function onRightMouseUp(mouseX, mouseY){
		if (mouseX == this.rightMouseDownXY[0] && mouseY == this.rightMouseDownXY[1]){
			this.onRightClick(mouseX, mouseY);
		}
	}

	function onRightClick(mouseX, mouseY){
		if (this.mode == 'pose'){
			var clickVector = this.getClickVector(mouseX, mouseY, this.camera);
			this.raycaster.set(this.camera.position, clickVector.sub(this.camera.position).normalize());

			var intersections = this.raycaster.intersectObjects(this.boneHandles, false);
			var closestBone = null, closestDistance = null;
			for (var i = 0; i < intersections.length; i++){
				var boneHandle = intersections[i].object;
				var boneGroup = character.boneGroups.get(boneHandle.boneGroupUid);
				var bone = boneGroup.skeleton.bones[boneHandle.boneIndex];
				if (bone.name.startsWith("#")){
					continue;
				}
				if (closestBone === null || intersections[i].distance < closestDistance){
					closestBone = bone;
					closestDistance = intersections[i].distance;
				}
			}
			this.selectedBone = closestBone;

			if (closestBone == null){
				this.boneAxisHelper.visible = false;
			} else {
				this.boneAxisHelper.visible = true;
				console.log("Clicked on " + this.selectedBone.name);

				var globalBonePosition = new THREE.Vector3()
				this.scene.updateMatrixWorld();
				globalBonePosition.setFromMatrixPosition(closestBone.matrixWorld);
				this.rotationBoneOrigin = this.getScreenCoordinates(globalBonePosition);
			}
		} else if (this.mode == 'mesh'){
			var pickingTexture = this.meshPickingView.pickingTexture;
			this.renderer.render(this.meshPickingView.scene, this.camera, pickingTexture);
			var pixelBuffer = new Uint8Array(4);
			this.renderer.readRenderTargetPixels(pickingTexture, mouseX, pickingTexture.height - mouseY, 1, 1, pixelBuffer);
			
			// Create id from RGB values
			var colorId = ( pixelBuffer[0] << 16 ) | ( pixelBuffer[1] << 8 ) | ( pixelBuffer[2] );
			var meshId = this.meshPickingView.meshIdMap[colorId];
			var meshResult = model.character.getMesh(meshId);
			if (meshResult == null){
				this.selectMesh(null);
				this.hideLibrary('mesh');
			} else {
				boneGroupUid = meshResult[0];
				mesh = meshResult[1];
				this.selectMesh(mesh);
				this.libraryClearMeshes();
				this.libraryPopulateMeshes(boneGroupUid);
				this.showLibrary('mesh');
			}
		} else if (this.mode == 'bone'){
			var pickingTexture = this.meshPickingView.pickingTexture;
			this.renderer.render(this.meshPickingView.scene, this.camera, pickingTexture);
			var pixelBuffer = new Uint8Array(4);
			this.renderer.readRenderTargetPixels(pickingTexture, mouseX, pickingTexture.height - mouseY, 1, 1, pixelBuffer);
			
			// Create id from RGB values
			var colorId = ( pixelBuffer[0] << 16 ) | ( pixelBuffer[1] << 8 ) | ( pixelBuffer[2] );
			var meshId = this.meshPickingView.meshIdMap[colorId];			var meshResult = model.character.getMesh(meshId);
			if (meshResult == null){
				this.selectBoneGroup(null);
			} else {
				boneGroupUid = meshResult[0];
				var boneGroup = character.boneGroups.get(boneGroupUid);
				this.selectBoneGroup(boneGroup);
			}
		}
	}

	function onMiddleMouseDown(mouseX, mouseY, event){
		console.log("Middle click");
	}

	function onMouseMove(mouseX, mouseY){
		this.mouseX = mouseX;
		this.mouseY = mouseY;

		if (this.editMode === 'rotate'){
			var factor = 500.0;

			var dx = (this.editMouseOriginX - this.rotationBoneOrigin.x);
			var dy = (this.editMouseOriginY - this.rotationBoneOrigin.y);
			var angle1 = Math.atan2(dy, dx);

			dx = (mouseX - this.rotationBoneOrigin.x);
			dy = (mouseY - this.rotationBoneOrigin.y);
			var angle2 = Math.atan2(dy, dx);

			var combinedAngle = angle1 - angle2;

			this.selectedBone.rotation.setFromVector3(this.initialRotation);
			this.selectedBone.updateMatrix();
			var rotation = this.selectedBone.parent.getWorldRotation()
			var inverseRotation = new THREE.Euler(rotation.x * -1, rotation.y * -1, rotation.z * -1, rotation.order);

			if (this.editAxis == 'X'){
				var axisClone = this.X_AXIS.clone();
				axisClone.applyEuler(inverseRotation);
				this.selectedBone.rotateOnWorldAxis(axisClone, combinedAngle);
			} else if (this.editAxis == 'Y'){
				var axisClone = this.Y_AXIS.clone();
				axisClone.applyEuler(inverseRotation);
				this.selectedBone.rotateOnWorldAxis(axisClone, combinedAngle);
			} else if (this.editAxis == 'Z'){
				var axisClone = this.Z_AXIS.clone();
				axisClone.applyEuler(inverseRotation);
				this.selectedBone.rotateOnWorldAxis(axisClone, combinedAngle);
			} else {
				var cameraAxis = this.getClickVector(window.width/2, window.height/2, this.camera);
				cameraAxis.applyEuler(inverseRotation);
				this.selectedBone.rotateOnWorldAxis(cameraAxis, combinedAngle);
			}
		} else if (this.editMode === 'move'){
			var dx = (mouseX - this.editMouseOriginX);
			var dy = (mouseY - this.editMouseOriginY);
			var distance = Math.sqrt(dx * dx + dy * dy);

			if (this.editAxis == 'X'){
				this.selectedBone.position.x = this.initialPosition.x + dx/100.0;
			} else if (this.editAxis == 'Y'){
				this.selectedBone.position.y = this.initialPosition.y - dy/100.0;
			} else if (this.editAxis == 'Z'){
				this.selectedBone.position.z = this.initialPosition.z + dx/100.0;
			} else {
				
			}

		} else if (this.editMode === 'scale'){
			//TODO: This 'distance1' stuff doesn't need to be calculated each time the mouse is moved. Same above.
			var dx = (this.editMouseOriginX - this.rotationBoneOrigin.x);
			var dy = (this.editMouseOriginY - this.rotationBoneOrigin.y);
			var distance1 = Math.sqrt(dx * dx + dy * dy);

			var dx = (mouseX - this.rotationBoneOrigin.x);
			var dy = (mouseY - this.rotationBoneOrigin.y);
			var distance2 = Math.sqrt(dx * dx + dy * dy);
			
			var scaleAmount = (distance2 - distance1)/200.0;
			if (this.editAxis == 'X'){
				this.selectedBone.scale.x = this.initialScale.x + scaleAmount;
			} else if (this.editAxis == 'Y'){
				this.selectedBone.scale.y = this.initialScale.y + scaleAmount;
			} else if (this.editAxis == 'Z'){
				this.selectedBone.scale.z = this.initialScale.z + scaleAmount;
			} else {
				this.selectedBone.scale.x = this.initialScale.x + scaleAmount;
				this.selectedBone.scale.y = this.initialScale.y + scaleAmount;
				this.selectedBone.scale.z = this.initialScale.z + scaleAmount;
			}
			
		}
	}

	function onDeletePressed(){
		if (this.mode == 'mesh'){
			// If only one mesh left, add the Box mesh so that there is still something
			// to click on, and issue a warning.
			var boneGroup = character.boneGroups.get(this.selectedMesh.boneGroupUid);
			if (Object.keys(boneGroup.meshes.dict).length <= 1){
				uilog("Can't delete the last mesh in a bone group! Delete the whole bone group instead.");
				addMesh(boneGroup.uid, boneGroup.libraryName, "box");
				this.selectMeshFuture(boneGroup.uid, "box");
			}

			removeMesh(this.selectedMesh.uid);
		} else if (this.mode == 'bone'){
			removeBoneGroup(this.selectedBoneGroup.uid);
		}
	}

	function clickedAddMesh(){
		var boneGroup = character.boneGroups.get(this.selectedMesh.boneGroupUid);
		addMesh(boneGroup.uid, boneGroup.libraryName, "box");
		this.selectMeshFuture(boneGroup.uid, "box");

		this.libraryClearMeshes();
		this.libraryPopulateMeshes(boneGroup.uid);
		this.showLibrary('mesh');
	}

	function getScreenCoordinates(obj){

		var vector = obj.clone();
		var windowWidth = window.innerWidth;
		var minWidth = 1280;

		if(windowWidth < minWidth) {
			windowWidth = minWidth;
		}

		var widthHalf = (windowWidth/2);
		var heightHalf = (window.innerHeight/2);

		vector.project(this.camera);

		vector.x = ( vector.x * widthHalf ) + widthHalf;
		vector.y = - ( vector.y * heightHalf ) + heightHalf;
		vector.z = 0;

		return vector;
	}
};

function onMouseDown(event){
	if (event.button === 0){
		view.onLeftMouseDown(event.clientX, event.clientY, event);
	} else if (event.button == 1){
		view.onMiddleMouseDown(event.clientX, event.clientY, event);
	} else if (event.button == 2){
		view.onRightMouseDown(event.clientX, event.clientY, event);
	}
}

function onMouseUp(event){
	if (event.button === 0){
		view.onLeftMouseUp(event.clientX, event.clientY, event);
	} else if (event.button == 1){
		// Middle click
	} else if (event.button == 2){
		view.onRightMouseUp(event.clientX, event.clientY, event);
	}
}

function onMouseMove(event){
	view.onMouseMove(event.clientX, event.clientY);
}

function onKeyDown(event){

	//check to see if you're typing in a input or form field, if so skip this event
	var target = event.target;
	if ( $(target).is('input') || $(target).is('textarea') ) {
		//continue bubling up the event chain, but don't do this method
		return true;
	}

	var keynum;	

    if(window.event) { // IE                    
      keynum = event.keyCode;
    } else if(event.which){ // Netscape/Firefox/Opera                   
      keynum = event.which;
    }

    if (keynum == 46){ // Delete
    	view.onDeletePressed();
    } else if (keynum == 219){ // 
		view.setMode('mesh picking');
    } else if (keynum == 221){ // 

    }

    var letter = String.fromCharCode(keynum);

    if (letter == 'P' || letter == 'p'){
    	view.setMode('pose');
    } else if (letter == 'M' || letter == 'm'){
    	view.setMode('mesh');
    } else if (letter == 'B' || letter == 'b'){
    	view.setMode('bone');
    } else if (letter == 'R' || letter == 'r'){
    	view.startBoneRotate();
    } else if (letter == 'G' || letter == 'g'){
    	view.startBoneMove();
    } else if (letter == 'S' || letter == 's'){
    	view.startBoneScale();
    } else if ('XxYyZz'.indexOf(letter) != -1){
    	view.setEditAxis(letter);
    } else if (letter == "h" || letter == "H"){
    	//TODO: Make this update the photo_render
    	var dataUrl =  window.view.renderer.domElement.toDataURL("image/png");
    	console.log(dataUrl);
    }
}

document.addEventListener('mousedown', onMouseDown, false);
document.addEventListener('mouseup', onMouseUp, false);
document.onmousemove = onMouseMove;
document.addEventListener('keydown', onKeyDown, false);