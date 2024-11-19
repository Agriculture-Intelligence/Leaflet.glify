import { IconPoints, IIconPointsSettings, IIconVertex } from "./icon-points";
import { ICanvasOverlayDrawEvent } from "./canvas-overlay";
import {
  Feature,
  FeatureCollection,
  Point as GeoPoint,
  GeoJsonProperties,
} from "geojson";
import { LeafletMouseEvent, Map, LatLng } from "leaflet";

import fontAtlasJson from "./resources/helvetica-msdf/Helvetica-msdf.json";
import fontAtlasImageSrc from "./resources/helvetica-msdf/Helvetica.png";

// test
class MapState {
  private _zoom: number = 0;
  private _scale: number = 0;
  private _map: Map;

  constructor(map: Map) {
    this._map = map;
    this.setMapState(); // Initialize state
  }

  public setMapState = () => {
    if (!this._map) {
      throw new Error("Map reference is not set");
    }

    try {
      const newZoom = this._map.getZoom();
      if (typeof newZoom !== "number") {
        throw new Error("Invalid zoom value returned from map");
      }

      if (newZoom !== this._zoom) {
        this._zoom = newZoom;
        this._scale = Math.pow(2, this._zoom);
      }
    } catch (error: any) {
      throw new Error(`Failed to update map state: ${error.message}`);
    }
  };

  get zoom(): number {
    return this._zoom;
  }

  get scale(): number {
    return this._scale;
  }
}

interface IColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface ILabeledIconPointsSettings extends IIconPointsSettings {
  labelText?: (
    feature?: Feature<GeoPoint, GeoJsonProperties> | number[],
    index?: number
  ) => string;
  labelFont?: string;
  labelColor?: IColor;
  labelOffset?: [number, number];
  globalScaleFactor?: number;
  labelTextSmoothing?: number;
  labelBackgroundColor?: IColor;
  labelBackgroundPadding?: [number, number];
  labelBackgroundCornerRadius?: number;
  labelBackgroundOutlineThickness?: number;

  // shaders
  labelBackgroundVertexShaderSource: () => string;
  labelBackgroundFragmentShaderSource: () => string;
  labelTextVertexShaderSource: () => string;
  labelTextFragmentShaderSource: () => string;
}

// TODO ?
interface ILabeledFeature extends Feature<GeoPoint> {
  properties: {
    labelText?: string;
    labelOffset?: [number, number];
    labelFont?: string;
    labelColor?: IColor;
    labelBackgroundColor?: IColor;
    labelBackgroundPadding?: [number, number];
    labelBackgroundCornerRadius?: number;
    labelBackgroundOutlineThickness?: number;
  } & GeoJsonProperties;
}

class LabeledIconPoints extends IconPoints {
  private isWebGL2: boolean;
  private labelShader: WebGLProgram | null = null;
  private backgroundShader: WebGLProgram | null = null;
  private fontTexture: WebGLTexture | null = null;
  private fontAtlas: any | null = null;
  private glyphQuad: WebGLBuffer | null = null;
  private labelInstanceData: WebGLBuffer | null = null;
  private backgroundBuffer: WebGLBuffer | null = null;
  private labelSettings: ILabeledIconPointsSettings;

  private isInitialized: boolean = false;
  private initPromise: Promise<void>; // not doing anything with this yet, but should...

  private totalGlyphs: number;

  private textData: number[] = [];
  private backgroundData: number[] = [];

  private atlasSize: [number, number] = [0, 0];

  // TODO expand map state, save more here?
  private mapState = new MapState(this.map);

  // TODO TEMP
  // WARN TEMP
  // OPTIONS OPTIONS!!
  private globalScaleFactor: number;

  // TODO TEMP
  // WARN TEMP
  // PROPERLY USE THE FEATURE COLLECTION
  private likuNumberArray: string[] = [];

  constructor(settings: ILabeledIconPointsSettings) {
    super(settings);
    // defaults .. ?
    this.labelSettings = {
      labelOffset: [25, -40],
      labelFont: "Helvetica", // wtf i am not even using this for anything yet what was i smoking?
      labelColor: { r: 0, g: 0, b: 0, a: 1 },
      labelBackgroundColor: { r: 255, g: 255, b: 255, a: 1 },
      labelText: () => "",
      labelBackgroundPadding: [10, 10],
      labelBackgroundCornerRadius: 20,
      labelBackgroundOutlineThickness: 16,
      globalScaleFactor: 0.6,
      labelTextSmoothing: 0.3,
      ...settings,
    };

    // Check for WebGL2 support
    this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;
    // console.log("isWebGL2:", this.isWebGL2);

    this.globalScaleFactor = this.labelSettings.globalScaleFactor ?? 0.5;

    this.totalGlyphs = 0;

    this.initPromise = this.initializeLabelRendering();
  }

  private async initializeLabelRendering(): Promise<void> {
    try {
      // console.log("awaiting super.ready()");
      await super.ready();
      // console.log("super.ready() resolved");
      // console.log("initializing label rendering");
      await this.loadFontAtlas();
      await this.createShaders();
      await this.createBuffers();

      // TEST

      this.gl.depthMask(true);
      this.gl.depthFunc(this.gl.LEQUAL);
      // this.gl.depthFunc(this.gl.LESS);
      this.gl.enable(this.gl.DEPTH_TEST);

      // TEST

      this.isInitialized = true;
      // console.log("label rendering initialized");
    } catch (error) {
      console.error("Failed to initialize label rendering:", error);
    }
  }

  // rethink?
  private async loadFontAtlas(): Promise<void> {
    this.fontAtlas = fontAtlasJson;

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const texture = this.gl.createTexture();
        if (!texture) {
          reject(new Error("Failed to create texture"));
          return;
        }
        this.fontTexture = texture;

        // TODO separate out, call in own func, needs to be re called?
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.fontTexture);
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          image
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_WRAP_S,
          this.gl.CLAMP_TO_EDGE
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_WRAP_T,
          this.gl.CLAMP_TO_EDGE
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_MIN_FILTER,
          this.gl.LINEAR
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_MAG_FILTER,
          this.gl.LINEAR
        );

        this.atlasSize = [image.width, image.height];

        resolve();
      };

      image.onerror = () => {
        reject(new Error("Failed to load font atlas image"));
      };

      // Set the source to the imported base64 image data
      // is converted to b64 by webpack plugin
      image.src = fontAtlasImageSrc;
    });
  }

  private async createShaders() {
    this.backgroundShader = this.createShaderProgram(
      this.labelSettings.labelBackgroundVertexShaderSource(),
      this.labelSettings.labelBackgroundFragmentShaderSource()
    );
    this.labelShader = this.createShaderProgram(
      this.labelSettings.labelTextVertexShaderSource(),
      this.labelSettings.labelTextFragmentShaderSource()
    );
  }

  private createShaderProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    // console.log("Starting shader program creation");

    // console.log("Creating vertex shader");
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!vertexShader) {
      console.error("Failed to create vertex shader");
      throw new Error("Failed to create vertex shader");
    }
    // console.log("Vertex shader created successfully");

    // console.log("Setting vertex shader source");
    this.gl.shaderSource(vertexShader, vertexSource);
    // console.log("Compiling vertex shader");
    this.gl.compileShader(vertexShader);

    // console.log("Checking vertex shader compilation status");
    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertexShader);
      console.error("Vertex shader compilation failed:", info);
      throw new Error(`Vertex shader compilation failed: ${info}`);
    }
    // console.log("Vertex shader compiled successfully");

    // console.log("Creating fragment shader");
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      console.error("Failed to create fragment shader");
      throw new Error("Failed to create fragment shader");
    }
    // console.log("Fragment shader created successfully");

    // console.log("Setting fragment shader source");
    this.gl.shaderSource(fragmentShader, fragmentSource);
    // console.log("Compiling fragment shader");
    this.gl.compileShader(fragmentShader);

    // console.log("Checking fragment shader compilation status");
    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fragmentShader);
      console.error("Fragment shader compilation failed:", info);
      throw new Error(`Fragment shader compilation failed: ${info}`);
    }
    // console.log("Fragment shader compiled successfully");

    // console.log("Creating shader program");
    const program = this.gl.createProgram();
    if (!program) {
      console.error("Failed to create shader program");
      throw new Error("Failed to create shader program");
    }
    // console.log("Shader program created successfully");

    // console.log("Attaching shaders to program");
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);

    // console.log("Linking shader program");
    this.gl.linkProgram(program);

    // console.log("Checking shader program link status");
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      console.error("Shader program link failed:", info);
      throw new Error(`Failed to link shader program: ${info}`);
    }
    // console.log("Shader program linked successfully");

    // console.log("Shader program creation completed");
    return program;
  }

  private createBuffers() {
    // const glyphQuadVertices = new Float32Array([
    //   0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1,
    // ]);
    const glyphQuadVertices = new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1,
    ]);

    const glyphQuad = this.gl.createBuffer();
    if (!glyphQuad) {
      throw new Error("Failed to create glyph quad buffer");
    }
    this.glyphQuad = glyphQuad;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glyphQuad);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      glyphQuadVertices,
      this.gl.STATIC_DRAW
    );

    const labelInstanceData = this.gl.createBuffer();
    if (!labelInstanceData) {
      throw new Error("Failed to create label instance data buffer");
    }
    this.labelInstanceData = labelInstanceData;

    const backgroundBuffer = this.gl.createBuffer();
    if (!backgroundBuffer) {
      throw new Error("Failed to create background buffer");
    }
    this.backgroundBuffer = backgroundBuffer;
  }

  render(): this {
    // console.log("render call!");
    if (this.isInitialized) {
      // console.log("is initialized");

      // call super render with optional property noRedraw = false to disable redraw call
      super.render(false);
      // console.log("super render called");

      // setup data for labels
      // needs to be called after super render since super render calls resetVertices and that sets up the coordinates
      // more of that can be reused tbh, i might be recalculating too much
      // also, consider destructuring render in the base class and using subfuncs here
      this.updateLabelInstanceData();

      // perform redraw call - will pass this.drawOnCanvas as a callback to rAF which should render all
      this.layer.redraw();
    }
    return this;
  }

  private setupStateBackground(): this {
    const { gl } = this;
    // console.log("setupStateBackground called");

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    // set up program
    gl.useProgram(this.backgroundShader!);

    // set up buffer
    // console.log("Binding backgroundBuffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.backgroundData),
      gl.STATIC_DRAW
    );

    // set up shader variables
    // position attribute
    const positionLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 4, gl.FLOAT, false, 60, 0);

    // size attribute
    const sizeLocation = gl.getAttribLocation(this.backgroundShader!, "size");
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 2, gl.FLOAT, false, 60, 16);

    // color attribute
    const colorLocation = gl.getAttribLocation(this.backgroundShader!, "color");
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 60, 24);

    // offset attribute
    const offsetLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "offset"
    );
    gl.enableVertexAttribArray(offsetLocation);
    gl.vertexAttribPointer(offsetLocation, 2, gl.FLOAT, false, 60, 40);

    // Zoffset attribute
    const offsetZLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "offsetZ"
    );
    gl.enableVertexAttribArray(offsetZLocation);
    gl.vertexAttribPointer(offsetZLocation, 1, gl.FLOAT, false, 60, 48);

    // rangeXY attribute
    const rangeXYLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "rangeXY"
    );
    gl.enableVertexAttribArray(rangeXYLocation);
    gl.vertexAttribPointer(rangeXYLocation, 2, gl.FLOAT, false, 60, 52);

    // set up instanced rendering

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(positionLocation, 1);
      gl2.vertexAttribDivisor(sizeLocation, 1);
      gl2.vertexAttribDivisor(colorLocation, 1);
      gl2.vertexAttribDivisor(offsetLocation, 1);
      gl2.vertexAttribDivisor(offsetZLocation, 1);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.vertexAttribDivisorANGLE(positionLocation, 1);
      ext.vertexAttribDivisorANGLE(sizeLocation, 1);
      ext.vertexAttribDivisorANGLE(colorLocation, 1);
      ext.vertexAttribDivisorANGLE(offsetLocation, 1);
      ext.vertexAttribDivisorANGLE(offsetZLocation, 1);
    }

    // set up uniforms
    this.setBackgroundUniforms();

    return this;
  }

  private setupStateText(): this {
    const { gl } = this;
    // console.log("setupStateText called");

    // sanity checks
    if (!this.labelShader) return this;

    if (!this.gl) return this;

    // set up program
    gl.useProgram(this.labelShader!);

    // set up glyqp quad buffer
    // console.log("Binding glyphQuad buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphQuad!); // data never changes

    // set up glyph quad attributes
    // position attribute
    const positionLocation = gl.getAttribLocation(
      this.labelShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    // gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 8, 0);

    // set up buffer
    // console.log("Binding labelInstanceData buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelInstanceData);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.textData),
      gl.STATIC_DRAW
    );

    // set up shader variables
    // position attribute
    const instancePositionLocation = gl.getAttribLocation(
      this.labelShader!,
      "instancePosition"
    );
    gl.enableVertexAttribArray(instancePositionLocation);
    gl.vertexAttribPointer(instancePositionLocation, 2, gl.FLOAT, false, 64, 0);
    // gl.vertexAttribPointer(instancePositionLocation, 2, gl.FLOAT, false, 36, 0);

    // offset attribute 1
    // this is float x offset between each char origin
    // text spacing etc
    const instanceOffsetXLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceOffsetX"
    );
    gl.enableVertexAttribArray(instanceOffsetXLocation);
    gl.vertexAttribPointer(instanceOffsetXLocation, 1, gl.FLOAT, false, 64, 8);
    // gl.vertexAttribPointer(instanceOffsetXLocation, 1, gl.FLOAT, false, 36, 8);

    // texCoord attribute
    const instanceTexCoordLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceTexCoord"
    );
    gl.enableVertexAttribArray(instanceTexCoordLocation);
    gl.vertexAttribPointer(
      instanceTexCoordLocation,
      4,
      gl.FLOAT,
      false,
      // 36,
      64,
      12
    );

    // // color attribute
    const instanceColorLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceColor"
    );
    gl.enableVertexAttribArray(instanceColorLocation);
    gl.vertexAttribPointer(instanceColorLocation, 4, gl.FLOAT, false, 64, 28);

    // offset attribute 2
    // this is float x offset between each char origin
    const instanceOffsetLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceOffset"
    );
    gl.enableVertexAttribArray(instanceOffsetLocation);
    gl.vertexAttribPointer(instanceOffsetLocation, 2, gl.FLOAT, false, 64, 44);

    // offset attribute 3
    // this is text offset for individual characters
    // used to align text with background
    const instanceTextOffsetLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceTextOffset"
    );
    gl.enableVertexAttribArray(instanceTextOffsetLocation);
    gl.vertexAttribPointer(
      instanceTextOffsetLocation,
      2,
      gl.FLOAT,
      false,
      64,
      52
    );

    // offset attribute 4
    // this is text offset for individual characters
    // used to align text with background
    const instanceZOffsetLocation = gl.getAttribLocation(
      this.labelShader!,
      "offsetZ"
    );
    gl.enableVertexAttribArray(instanceZOffsetLocation);
    gl.vertexAttribPointer(instanceZOffsetLocation, 1, gl.FLOAT, false, 64, 60);

    // set up instanced rendering
    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(positionLocation, 0);
      gl2.vertexAttribDivisor(instancePositionLocation, 1);
      gl2.vertexAttribDivisor(instanceOffsetXLocation, 1);
      gl2.vertexAttribDivisor(instanceTexCoordLocation, 1);
      gl2.vertexAttribDivisor(instanceColorLocation, 1);
      gl2.vertexAttribDivisor(instanceOffsetLocation, 1);
      gl2.vertexAttribDivisor(instanceTextOffsetLocation, 1);
      gl2.vertexAttribDivisor(instanceZOffsetLocation, 1);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.vertexAttribDivisorANGLE(positionLocation, 0);
      ext.vertexAttribDivisorANGLE(instancePositionLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceOffsetXLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceTexCoordLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceColorLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceOffsetLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceTextOffsetLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceZOffsetLocation, 1);
    }

    // set up uniforms
    this.setTextUniforms();

    return this;
  }

  private setBackgroundUniforms() {
    const { gl, mapMatrix } = this;

    // map transformation matrix
    const backgroundMatrixLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "matrix"
    );
    if (backgroundMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(backgroundMatrixLocation, false, mapMatrix.array);
    }

    // scale
    const scaleLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uScale"
    );
    if (scaleLocation === null) {
      console.error("Unable to get uniform location for 'uScale'");
    } else {
      gl.uniform1f(scaleLocation, this.mapState.scale);
    }

    // global scale
    const globalScaleLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uGlobalScale"
    );
    if (globalScaleLocation === null) {
      console.error("Unable to get uniform location for 'uGlobalScale'");
    } else {
      gl.uniform1f(globalScaleLocation, this.globalScaleFactor);
    }

    // background corner radius
    const backgroundRadiusLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uCornerRadius"
    );
    if (backgroundRadiusLocation === null) {
      console.error("Unable to get uniform location for 'uCornerRadius'");
    } else {
      const radius: number =
        this.labelSettings.labelBackgroundCornerRadius ?? 20;
      gl.uniform1f(backgroundRadiusLocation, radius);
    }

    // background outline thickness
    const backgroundOutlineLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uOutlineThickness"
    );
    if (backgroundOutlineLocation === null) {
      console.error("Unable to get uniform location for 'uOutlineThickness'");
    } else {
      const thock: number =
        this.labelSettings.labelBackgroundOutlineThickness ?? 4;
      gl.uniform1f(backgroundOutlineLocation, thock);
    }
  }

  private drawBackgrounds() {
    const { gl } = this;

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;

      // Instanced rendering
      gl2.drawArraysInstanced(
        gl2.TRIANGLE_STRIP,
        0,
        4,
        this.allLatLngLookup.length
      );
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }

      // Instanced rendering
      ext.drawArraysInstancedANGLE(
        gl.TRIANGLE_STRIP,
        0,
        4,
        this.allLatLngLookup.length
      );
    }
  }

  private setTextUniforms() {
    const { gl, mapMatrix } = this;

    const textMatrixLocation = gl.getUniformLocation(
      this.labelShader!,
      "matrix"
    );
    if (textMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(textMatrixLocation, false, mapMatrix.array);
    }

    // scale
    const scaleLocation = gl.getUniformLocation(this.labelShader!, "uScale");
    if (scaleLocation === null) {
      console.error("Unable to get uniform location for 'uScale'");
    } else {
      gl.uniform1f(scaleLocation, this.mapState.scale);
    }

    // global scale
    const globalScaleLocation = gl.getUniformLocation(
      this.labelShader!,
      "uGlobalScale"
    );
    if (globalScaleLocation === null) {
      console.error("Unable to get uniform location for 'uGlobalScale'");
    } else {
      gl.uniform1f(globalScaleLocation, this.globalScaleFactor);
    }

    // texture Atlas
    const atlasSizeLocation = gl.getUniformLocation(
      this.labelShader!,
      "atlasSize"
    );
    if (atlasSizeLocation === null) {
      console.error("Unable to get uniform location for 'atlasSize'");
    } else {
      gl.uniform2f(atlasSizeLocation, this.atlasSize[0], this.atlasSize[1]);
    }

    // texture registry
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fontTexture);
    const fontTextureLocation = gl.getUniformLocation(
      this.labelShader!,
      "fontTexture"
    );
    if (fontTextureLocation === null) {
      console.error("Unable to get uniform location for 'fontTexture'");
    } else {
      // 1 here points to texture registry 1
      gl.uniform1i(fontTextureLocation, 1);
    }

    // smothing factor
    const smoothingLocation = gl.getUniformLocation(
      this.labelShader!,
      "smoothing"
    );
    if (smoothingLocation === null) {
      console.error("Unable to get uniform location for 'smoothing'");
    } else {
      const smoothing: number = this.labelSettings.labelTextSmoothing ?? 0.3;
      gl.uniform1f(smoothingLocation, smoothing); // Adjust as needed
    }

    // pxRange constant set based on msdf atlas
    // TODO get from json
    const pxRangeConstLocation = gl.getUniformLocation(
      this.labelShader!,
      "pxRangeConst"
    );
    if (pxRangeConstLocation === null) {
      console.error("Unable to get uniform location for 'pxRangeConst'");
    } else {
      // distanceRange from msdfgen json
      gl.uniform1f(pxRangeConstLocation, 4.0);
    }
  }

  private drawText() {
    const { gl } = this;

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    // WARN debug
    // console.log("Program info log:", gl.getProgramInfoLog(this.labelShader!));
    // console.log("Viewport:", gl.getParameter(gl.VIEWPORT));
    // console.log("Scissor test enabled:", gl.getParameter(gl.SCISSOR_TEST));
    // console.log("Scissor box:", gl.getParameter(gl.SCISSOR_BOX));
    // console.log("Blend enabled:", gl.getParameter(gl.BLEND));
    // console.log(
    //   "Blend func:",
    //   gl.getParameter(gl.BLEND_SRC_RGB),
    //   gl.getParameter(gl.BLEND_DST_RGB)
    // );
    // console.log("Depth test enabled:", gl.getParameter(gl.DEPTH_TEST));
    // console.log("Depth func:", gl.getParameter(gl.DEPTH_FUNC));
    // console.log("Stencil test enabled:", gl.getParameter(gl.STENCIL_TEST));
    // console.log("Cull face enabled:", gl.getParameter(gl.CULL_FACE));
    // console.log("Cull face mode:", gl.getParameter(gl.CULL_FACE_MODE));
    // console.log("Drawing text:", gl.TRIANGLES, 0, 6, glyphs);

    // WARN debug

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.drawArraysInstanced(gl2.TRIANGLES, 0, 6, this.totalGlyphs);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, this.totalGlyphs);
    }
  }

  private updateLabelInstanceData(): this {
    // console.log("Starting updateLabelInstanceData");

    this.textData = [];
    this.backgroundData = [];
    this.totalGlyphs = 0;

    if (!this.labelInstanceData || !this.backgroundBuffer) {
      // console.log("labelInstanceData or backgroundBuffer is null, returning");
      return this;
    }

    // console.log("Initialized textData and backgroundData arrays");

    const features = Array.isArray(this.settings.data)
      ? this.settings.data
      : (this.settings.data as FeatureCollection<GeoPoint>).features || [];

    // console.log("Features data:", features);
    // console.log("Number of features:", features.length);

    const increment = this.incrementZ;

    features.forEach((feature, index) => {
      const zOffset = index * (4 * increment);
      // console.log(`Processing feature ${index}:`, feature);

      // console.log("calling getLabelText with index:", index);
      const text = this.getLabelText(
        feature as ILabeledFeature | number[],
        index
      );
      // console.log("Label text:", text);

      const rawLatLng = this.allLatLngLookup[index].latLng;
      const pixel = this.map.project(rawLatLng, 0);
      const position: [number, number] = [
        pixel.x - this.mapCenterPixels.x,
        pixel.y - this.mapCenterPixels.y,
      ];

      // console.log("Calculated label position:", position);

      const labelColor = this.getLabelColor(
        feature as ILabeledFeature | number[]
      );
      // console.log("Label color:", labelColor);

      const backgroundColor = this.getLabelBackgroundColor(
        feature as ILabeledFeature | number[]
      );
      // console.log("Background color:", backgroundColor);

      const padding = this.getLabelBackgroundPadding(
        feature as ILabeledFeature | number[]
      );
      // const padding: [number, number] = [10, 10];
      // console.log("Background padding:", padding);

      const pixelOffset = this.getLabelOffset(
        feature as ILabeledFeature | number[]
      );
      // const pixelOffset: [number, number] = [25, -40];
      // console.log("Label offset:", pixelOffset);

      // accumulators
      let xOffset = padding[0] * this.globalScaleFactor; // initial xOffset for text, padding

      let maxWidth = 0;
      let maxHeight = 0;

      let maxYOffset = 0;
      let minYOffset = 0;

      let firstXOffset: number = 0;
      let lastXOffset: number = 0;

      let prevChar: number | null = null;

      const textZOffset: number = zOffset + 2 * increment;

      if (text === undefined) {
        return;
      }

      // char loop
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // console.log(`Processing character: ${char}`);

        // TODO change any type
        const charInfo = this.fontAtlas.chars.find((c: any) => c.char === char);

        if (i === 0) {
          firstXOffset = charInfo.xoffset;
        } else if (i === text.length - 1) {
          lastXOffset = charInfo.xoffset;
        }

        // TODO add " " space handling
        if (!charInfo) {
          // console.log(`No char info for: ${char}, skipping`);
          continue;
        } else {
          if (prevChar) {
            const kerning = this.fontAtlas.kernings.find(
              (k: any) => k.first === prevChar && k.second === charInfo.id
            );
            if (kerning) {
              xOffset += kerning.amount;
            }
          }
          // console.log("Char info:", charInfo);
        }

        const charData = [
          // position is in leaflet coordinates at zoom level 0 shifted to use a central origin
          // cuz leaflet uses central origin - offsets are scaled to zoom 0 and applied in the shader
          position[0], // WARN the corresponding shader parameter is called instancePosition ! could be confusing
          position[1],
          xOffset, // in pixels, scaled in the shader
          charInfo.x,
          charInfo.y,
          charInfo.width,
          charInfo.height, // pixels, scaled in the shader
          labelColor.r, // color
          labelColor.g,
          labelColor.b,
          labelColor.a ?? 1,
          pixelOffset[0], // this is identical for all characters in a label - is used to line up text with background!
          pixelOffset[1],
          charInfo.xoffset,
          charInfo.yoffset,
          textZOffset,
        ];

        // console.log("Char data to be pushed:", charData);

        this.textData.push(...charData);

        // increment total glyph counter
        this.totalGlyphs++;

        prevChar = charInfo.id;

        xOffset += charInfo.xadvance;

        maxWidth = Math.max(maxWidth, xOffset);
        maxHeight = Math.max(maxHeight, charInfo.height);

        maxYOffset = Math.max(maxYOffset, charInfo.yoffset);
        minYOffset = Math.min(minYOffset, charInfo.yoffset);
      }

      // xOffset += padding[0] * this.globalScaleFactor; // final xOffset for text, padding

      // console.log("Final xOffset:", xOffset);
      // console.log("Max width:", maxWidth);
      // console.log("Max height:", maxHeight);

      // console.log("Max y offset:", maxYOffset);
      // console.log("Min y offset:", minYOffset);

      const yRange = Math.abs(maxYOffset - minYOffset);

      const xRange = Math.abs(firstXOffset - lastXOffset);

      // TODO move calc into vertex shader
      // WARN seriously, this is gonna eat up a lot of time here
      // doing what is basically a bunch of pow3 operations
      // const bgWidth =
      //   maxWidth +
      //   padding[0] * this.globalScaleFactor * 2 +
      //   xRange * this.globalScaleFactor;

      // const bgHeight =
      //   maxHeight +
      //   padding[1] * this.globalScaleFactor * 2 +
      //   yRange * this.globalScaleFactor;

      const bgData = [
        // position is in leaflet coordinates at zoom level 0 shifted to use a central origin
        // cuz leaflet uses central origin - offsets are scaled to zoom 0 and applied in the shader
        position[0],
        position[1],
        padding[0],
        padding[1],
        maxWidth,
        maxHeight,
        backgroundColor.r,
        backgroundColor.g,
        backgroundColor.b,
        backgroundColor.a ?? 1,
        pixelOffset[0],
        pixelOffset[1],
        zOffset,
        xRange,
        yRange,
      ];
      // console.log("Background data to be pushed:", bgData);

      this.backgroundData.push(...bgData);

      // increment zOffset by two increments
      // text is always drawn with an additional increment to make sure it is above the background
      // we add two here to make sure the next label is drawn above the current text and baclground
      // t = 0: text offset: 1i, background offset: 0i,
      // t = 1: text offset: 3i, background offset: 2i,
      // ...
      // moved to const scaled by index
      // const incrementMultiple: number = increment * 4;
      // zOffset = zOffset + incrementMultiple;
    });

    // console.log("Final textData length:", this.textData.length);
    // console.log("Final backgroundData length:", this.backgroundData.length);

    // console.log("Finished updateLabelInstanceData");

    return this;
  }

  drawOnCanvas(e: ICanvasOverlayDrawEvent): this {
    // TODO
    // consider drawing into framebuffer here, then using post processing for AA
    // console.log("drawOnCanvas from labeled-icon-points called");

    if (this.mapState) {
      // console.log("getting map snapshot");
      this.mapState.setMapState();
    } else {
      // console.log("mapState not yet available");
    }

    if (this.gl) {
      // INFO temp TESTING
      // this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
    }

    // super drawOnCanvas does extras:
    // updates map matrix
    // clears color buffer
    // sets up viewport

    // console.log("super.drawOnCanvas");
    super.drawOnCanvas(e);

    // console.log("Setting up background state");
    this.setupStateBackground();

    // console.log("Drawing backgrounds");
    this.drawBackgrounds();

    // console.log("Setting up text state");
    this.setupStateText();

    // console.log("Drawing text");
    this.drawText();

    // if (this.gl) {
    //   // INFO temp TESTING
    //   this.gl.disable(this.gl.DEPTH_TEST);
    // }

    return this;
  }

  // private calculateLabelPosition(
  //   iconVertex: IIconVertex,
  //   offset: [number, number]
  // ): [number, number] {
  //   const { map } = this;
  //   const point = map.latLngToContainerPoint(iconVertex.latLng);
  //   return [point.x + offset[0], point.y + offset[1]];
  // }

  private getLabelText(
    feature: Feature<GeoPoint, GeoJsonProperties> | ILabeledFeature | number[],
    index?: number
  ): string {
    // TODO fix, implement something not stupid
    // if (Array.isArray(feature)) {
    //   return this.labelSettings.labelText?.(feature, index) ?? "";
    // }
    // if (
    //   "properties" in feature &&
    //   feature.properties &&
    //   "labelText" in feature.properties
    // ) {
    //   return feature.properties.labelText ?? "";
    // }
    // if (this.labelSettings.labelText) {
    //   return this.labelSettings.labelText(feature, index);
    // }

    try {
      return this.likuNumberArray[index!];
    } catch {
      console.log("Error in getLabelText");
    }

    return "";
  }

  private getLabelOffset(
    feature: ILabeledFeature | number[]
  ): [number, number] {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelOffset ?? [25, -40];
    }
    if (feature.properties && feature.properties.labelOffset) {
      return feature.properties.labelOffset;
    }
    return this.labelSettings.labelOffset ?? [25, -40];
  }

  private getLabelColor(feature: ILabeledFeature | number[]): IColor {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelColor ?? { r: 0, g: 0, b: 0, a: 1 };
    }
    if (feature.properties && feature.properties.labelColor) {
      return feature.properties.labelColor;
    }
    return this.labelSettings.labelColor ?? { r: 0, g: 0, b: 0, a: 1 };
  }

  private getLabelBackgroundColor(feature: ILabeledFeature | number[]): IColor {
    if (Array.isArray(feature)) {
      return (
        this.labelSettings.labelBackgroundColor ?? {
          r: 255,
          g: 255,
          b: 255,
          a: 1,
        }
      );
    }
    if (feature.properties && feature.properties.labelBackgroundColor) {
      return feature.properties.labelBackgroundColor;
    }
    return (
      this.labelSettings.labelBackgroundColor ?? {
        r: 255,
        g: 255,
        b: 255,
        a: 1,
      }
    );
  }

  private getLabelBackgroundPadding(
    feature: ILabeledFeature | number[]
  ): [number, number] {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelBackgroundPadding ?? [10, 10];
    }
    if (feature.properties && feature.properties.labelBackgroundPadding) {
      return feature.properties.labelBackgroundPadding;
    }
    return this.labelSettings.labelBackgroundPadding ?? [10, 10];
  }

  setData(data: FeatureCollection<GeoPoint> | number[][]): this {
    this.settings = { ...this.settings, data };
    return this.render();
  }

  // TODO switch to proper input data types omg
  setLikuNumberArray(likuNumberArray: string[]) {
    // console.log("Setting likuNumberArray !!!!!");
    try {
      this.likuNumberArray = likuNumberArray;
    } catch {
      // console.error("Error in setLikuNumberArray");
    }

    return this;
  }

  // INFO error might be from here?
  resetVertices(): this {
    // console.log("Resetting base class vertices");
    super.resetVertices();
    return this;
  }

  // Add these static methods
  static tryClick(
    e: LeafletMouseEvent,
    map: Map,
    instances: LabeledIconPoints[]
  ): boolean | undefined {
    // TODO implement ?
    // TODO i dont know if i even implemented this in the base class
    // I definitely haven't tested it yet or even gotten that far...
    // Pls dont be too much work in the future :(
    // INFO make sure the icon points function is working first, then just use super.tryClick() here
    return undefined;
  }

  static tryHover(
    e: LeafletMouseEvent,
    map: Map,
    instances: LabeledIconPoints[]
  ): Array<boolean | undefined> {
    // TODO implement ?
    // TODO i dont know if i even implemented this in the base class
    // I definitely haven't tested it yet or even gotten that far...
    // Pls dont be too much work in the future :(
    // INFO make sure the icon points function is working first, then just use super.tryHover() here
    return [];
  }
}

export { LabeledIconPoints, ILabeledIconPointsSettings };
