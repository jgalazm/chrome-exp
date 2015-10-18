var canvasWidth = 500;
var canvasHeight = 500;

//World constants.
var gravity = 9.81;

// Physical world.
var water = [];


// Time
var simStep = 1/30; //30FPS

//Display world
var xoffset = canvasWidth*0.00;
var ylim = [];

// Mouse.
var mouseX, mouseY, mouseDown;
var clickRadius = 30;


function init()
{
    // init_controls();
    
    //dom objects
    canvas = document.getElementById("myCanvas");
    simulation = document.getElementById("simulation");

    //mouse event handlers
    canvas.onmousedown = onMouseDown;
    canvas.onmouseup = onMouseUp;
    canvas.onmousemove = onMouseMove;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    //set the canvas.
    ctx = canvas.getContext("2d");
    
    loadDambreak();
    
    setInterval(run, simStep*1000);
}

function loadDambreak()
{
    //1D Dambreak, 10m height first half, 5m second half, 10m long.
    var npoints = 100;
    var L = 10;
    var surface = new Array(npoints);
    var xvel = new Array(npoints);
    var yvel = new Array(npoints);
    ylim = [0, 11];

    for (var i = 0; i<npoints; i++){
        surface[i] = (i<npoints/2) ? 8 : 5;
        xvel[i] = 0;    
        yvel[i] = 0;
    }
    water = createWater(surface, xvel, yvel, [npoints,L]);
}


//---Create Polygon stuff

function createWater(surface, xvelocity, yvelocity, meshdata)
{
    var water = [];

    water = new Water(surface, xvelocity, yvelocity, meshdata);

    return water;
}


function Water(surface, xvelocity, yvelocity, meshdata)
{
    this.surface = surface;
    this.xvelocity = xvelocity;
    this.yvelocity = yvelocity;
    this.n = meshdata[0];
    this.L = meshdata[1];
    this.dx = this.L/this.n;
    this.x = [];
    for (var i=0; i<this.surface.length; i++){
        this.x.push(i*this.dx);
    }

    //mouse holding parameters
    this.hold = false;    //is any point held?
    this.held_index = -1; //which point is held, if any
    this.sigma = 1; //variance of the gaussian pulse in world units

    //display parameters
    this.radius = 3;//Math.log(mass);
    this.style = "rgba(200, 255, 255, 1)";    
    
    //save canvas coordinates to plot
    //add left and right margins and scale to plot
    this.disp_x = this.x.map(
        function(xi,index,x)
        {return xoffset+xi*(canvasWidth-2*xoffset)/x[x.length-1]} );

    //add top margin and scale to plot
    this.disp_surface = this.surface.map(
        function(surfi,index,surf) {return world2canvas_y(surfi)} );
    
    this.drawCurrent = function()
    {
        // Update the view.
        //probar ctx.clearRect(0,0,canvasWidth, canvasHeight)
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";//"#000000";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.strokeStyle = "#666666";
        
        ctx.beginPath();
        var floor_y = world2canvas_y(0)

        ctx.moveTo(water.disp_x[0], floor_y)    
        for(var i = 0; i < water.x.length; i++){
            ctx.lineTo(water.disp_x[i], water.disp_surface[i]);
        }
        ctx.lineTo(water.disp_x[water.x.length-1], floor_y);
        ctx.closePath();
        ctx.stroke();
        // ctx.fillStyle = "rgba(64, 164, 223, 0.3)";
        ctx.fillStyle = "rgba(64, 164, 223, 1)";
        ctx.fill();
        

        if (water.n < 40){
            for(var i = 0; i< water.x.length; i++){
                ctx.fillStyle = water.style;
                ctx.beginPath();
                ctx.arc(water.disp_x[i],  water.disp_surface[i], 
                    water.radius, 0, 2*Math.PI, false);
                ctx.closePath();
                ctx.fill();   
            }            
        }   

    }
   
    this.update = function(step)
    {
       if (this.hold)
       {
        //water.surface[this.held_index] = canvas2world_y(mouseY);
        //water.disp_surface[this.held_index] = mouseY;
        // gaussianPulse();
        splinePulse();
        
       }
       water.drawCurrent();
    }

    this.setHold = function(val)
    {
        this.hold = val;
    }

}
function gaussianPulse()
{   
    //transform to canvas units
    var sigma2 = Math.pow(water.sigma,2);
    var center = water.x[water.held_index];
    var amplitude = Math.abs(canvas2world_y(mouseY)-water.surface[water.held_index]);

    //apply pulse on [center-2sigma,center+2sigma] intersection [0,L]
    var x0 = Math.max(xoffset,canvas2world_x(mouseX)-2*water.sigma);
    var xf = Math.min(canvasWidth-xoffset, canvas2world_x(mouseX)+2*water.sigma);

    for (i=0; i<water.n; i++){
        if (water.x[i]> xf){
            return
        }
        else if (water.x[i] >= x0 && water.x[i] <= xf){
            var disp = amplitude*Math.exp(-Math.pow(water.x[i]-center,2)/sigma2);
            if (water.disp_surface[i]<mouseY){
                disp = -1*disp; 
            }
                 
            water.surface[i] += disp;   
            water.disp_surface[i] += -disp*canvasHeight/(ylim[1]-ylim[0]);
        }
    }


}

function splinePulse(){
    //transform to canvas units
    var sigma = water.sigma;
    var center = water.x[water.held_index];
    var amplitude = Math.abs(canvas2world_y(mouseY)-water.surface[water.held_index]);

    //spline formula with 0 derivative at control points
    // p(t) = (2t^3-3t^2+1)p0 + (-2t^3+t^2)p1
    var x0 = canvas2world_x(mouseX)-sigma;
    var xf = canvas2world_x(mouseX)+sigma;
    var xmid = canvas2world_x(mouseX);

    var i0 = getNearestFVCell([world2canvas_x(x0),0]);
    var iF = getNearestFVCell([world2canvas_x(xf),0]);
    x0 = (x0>0) ? water.x[i0] : x0;
    xf = (xf<water.x[water.n-1]) ? water.x[iF]: xf;


    var surf0 = water.surface[i0];
    var surff = water.surface[iF];
    var surfmid = canvas2world_y(mouseY);

    for (i=0; i<water.n; ++i){
        if (water.x[i]>= xf){
            return
        }
        else if (water.x[i] >= x0 && water.x[i] <= xf){
            
            if (water.x[i] < xmid){
                var t = (water.x[i] - x0)/(xmid-x0);
                console.log(x0);
                water.surface[i] = (2*t*t*t - 3*t*t +1)*surf0;
                water.surface[i] += (-2*t*t*t + 3*t*t)*surfmid;
            }
            else{
                var t = (water.x[i] - xmid)/(xf-xmid);
                water.surface[i] = (2*t*t*t - 3*t*t +1)*surfmid;
                water.surface[i] += (-2*t*t*t + 3*t*t)*surff;
             }
            
            water.disp_surface[i] = world2canvas_y(water.surface[i]);
        }
    }    
}


function world2canvas_y(y)
{
    return canvasHeight*(1 - (y-ylim[0])/(ylim[1]-ylim[0]) );
}   
function canvas2world_y(yc)
{
    return (1-yc/canvasHeight)*(ylim[1] - ylim[0]) + ylim[0];
}
function world2canvas_x(x)
{
    return x*(canvasWidth-2*xoffset)/water.L + xoffset;
}
function canvas2world_x(xc){
    return (xc-xoffset)*water.L/(canvasWidth-2*xoffset);
}

function run()
{
    //update al inicio o al final del run??, por ahora da igual
    water.update();
    
    // if(scaleAlpha > 0)
    // {
    //     drawScale(scaleAlpha);
    //     scaleAlpha -= 0.01;
    // }
}

//mouse interaction

function onMouseMove(e)
{
    var ev = e ? e : window.event;
    //pagex - offsetleft da la coordenada del canvas
    mouseX = ev.pageX - simulation.offsetLeft;
    mouseY = ev.pageY - simulation.offsetTop;
    if (water.hold)
        water.held_index = getNearestFVCell([mouseX,0]);
}

function onMouseDown(e)
{
    var ev = e ? e : window.event;
    mouseDown = true;

    var held_index = getNearestFVCell([mouseX, mouseY]);
    if(held_index==-1)
        return;
    
    if(ev.button == 0)
        holdFVCell(held_index);
    // if(ev.button == 1)
        // p.setPin(!p.pin);
}

function onMouseUp(e)
{
    mouseDown = false;
    releaseFVCell();
}

//needed by mouse
function getNearestFVCell(pos)
{
    var i = 0;
    var mindist = canvasWidth;
    var  minloc;
    for(i = 0; i < water.x.length; i++)
    {
        var canvas_fv_x = water.disp_x[i];
        var canvas_fv_y = water.disp_surface[i];
        // var dist = norm(diff([canvas_fv_x,canvas_fv_y], pos));
        //pick the closest cell in the y axis
        // var dist = norm(diff([canvas_fv_x,0], [pos[0],0]));
        var dist = Math.abs(canvas_fv_x - pos[0]);
        
        //always return a valid point
        // if(dist < clickRadius){
            // return i;
        // }
        if (dist < mindist){
            mindist = dist;
            minloc = i;
        }
    }
    // return -1;
    return minloc;
}

function holdFVCell(held_index)
{
    if(held_index>-1)
    {
        water.held_index = held_index
        water.setHold(true)
    }
}

function releaseFVCell()
{
    if (water.held_index>-1)
    {
        water.held_index = -1;
        water.setHold(false);
    }
}

//vector math
function norm(vector)
{
    var sum = 0;
    var i;
    for (i in vector)
        sum += vector[i]*vector[i];
    return Math.sqrt(sum);
}

function diff(p1, p2)
{
    var res = [];
    var i = 0;
    for(i = 0; i < p1.length; ++i)
        res[i] = p1[i] - p2[i];
    return res;
}