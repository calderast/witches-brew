declare module "mixbox" {
  type Latent = number[];
  const mixbox: {
    LATENT_SIZE: number;
    rgbToLatent(r: number, g: number, b: number): Latent;
    latentToRgb(latent: Latent): [number, number, number];
  };
  export default mixbox;
}
