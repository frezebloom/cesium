window.onload = function(){

  var viewer = new Cesium.Viewer('cesiumContainer');
  Cesium.Cartographic.fromDegrees(59.7975949, 30.4383431, 21);
  viewer.scene.globe.enableLighting = true;


  //Функция загрузки JSON с сервера
  function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("POST", file, true);
    rawFile.onreadystatechange = function() {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    }
    rawFile.send(null);
    }
    

    //Готовим данные для отображения контуров
    readTextFile("http://localhost:8080/jsonContours", function(text){

        const data = JSON.parse(text);
        
        
        for(let key in data.features){
     
                const properties = data.features[key].properties;
                const itemCoordinates = data.features[key].geometry.coordinates[0][0];
                
                var coordinates = [];

                itemCoordinates.forEach((item)=>{
                    coordinates.push(item[0]);
                    coordinates.push(item[1]);
                })  

                const colors = ['GREEN', 'YELLOW', 'RED'];
                const mod = key % 3;

                contoursShow(coordinates, colors[mod], properties);
          
        }
        
    });


    
    //Векторные контура
    contoursShow = (coordinates, colorArea, properties) => {
        const area = viewer.entities.add({
            
            name:     properties.name,
            
                
            
            polygon : {
              hierarchy : Cesium.Cartesian3.fromDegreesArray(

                    coordinates
                                        
                ),
              height : 0,
              material : Cesium.Color[colorArea].withAlpha(0.5),
              outline : true,
              outlineColor : Cesium.Color.BLACK
            }
          });
          area.description =    

          
            `<p> name_lat:   ${properties.name_lat}</p>
             <p> created_at: ${properties.created_at}</p>
             <p> updated_at: ${properties.updated_at}</p>
             <p> cartodb_id: ${properties.cartodb_id}</p>
            `  
    
    }




    //Готовим данные для отображения точек
    readTextFile("http://localhost:8080/jsonPoints", function(text){

        const data = JSON.parse(text);
        
        
        data.features.forEach((item) =>{
            const name = item.properties.title;
            const coordinates = item.geometry.coordinates;
            pointsShow(coordinates[0], coordinates[1], name);
        })
            
        
    });

    //точки
    pointsShow = (x, y, namePoint) =>{
        viewer.entities.add({
            position : Cesium.Cartesian3.fromDegrees(x, y),
            name : namePoint,
            point : {
                pixelSize : 10,
                color : Cesium.Color.BLUE
            }
        });
    }
    
}
   

