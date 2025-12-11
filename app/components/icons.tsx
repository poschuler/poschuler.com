import React from "react";
//import { LazyLoadImage } from 'react-lazy-load-image-component';
// import pkg from 'react-lazy-load-image-component';
// const { LazyLoadImage } = pkg;

type IconProps = {
  className?: string;
};

const PlazaVeaIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo.svg"
        alt={"Plaza Vea"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo.svg"
      //   alt={"Plaza Vea"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />
      // <img
      //   src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
PlazaVeaIcon.displayName = "PlazaVeaIcon";

const MetroIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
        alt={"Metro"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
      //   alt={"Metro"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />
      // <img
      //   src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
MetroIcon.displayName = "MetroIcon";

const TottusIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/tottus_logo.svg"
        alt={"Tottus"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/tottus_logo.svg"
      //   alt={"Tottus"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />
      // <img
      //   src="https://cdn.poschuler.dev/chekalo/tottus_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
TottusIcon.displayName = "TottusIcon";

const VivandaIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/vivanda_logo.svg"
        alt={"Vivanda"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/vivanda_logo.svg"
      //   alt={"Vivanda"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/vivanda_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
VivandaIcon.displayName = "VivandaIcon";

const WongIcon: React.FC<IconProps> = React.memo(({ className }: IconProps) => {
  return (
    <img
      src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
      alt={"Wong"}
      className={className}
      loading="lazy"
      //effect="blur"
      //visibleByDefault={true}
    />

    // <AsyncImage
    //   src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
    //   alt={"Wong"}
    //   Transition={(props) => <Blur radius={10} {...props} />}
    //   loader={<div style={{ background: "#888" }} />}
    // />

    // <img
    //   src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
    //   alt=""
    //   className={className}
    //   loading="lazy"
    // />
  );
});
WongIcon.displayName = "WongIcon";

const PlazaVeaIconSmall: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo_small.svg"
        alt={"Plaza Vea"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo_small.svg"
      //   alt={"Plaza Vea"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/plaza_vea_logo_small.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
PlazaVeaIconSmall.displayName = "PlazaVeaIconSmall";

const MetroIconSmall: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
        alt={"Metro"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
      //   alt={"Metro"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/metro_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
MetroIconSmall.displayName = "MetroIconSmall";

const TottusIconSmall: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/tottus_logo_small.svg"
        alt={"Metro"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/tottus_logo_small.svg"
      //   alt={"Metro"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/tottus_logo_small.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
TottusIconSmall.displayName = "TottusIconSmall";

const VivandaIconSmall: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/vivanda_logo_small.svg"
        alt={"Vivanda"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/vivanda_logo_small.svg"
      //   alt={"Vivanda"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/vivanda_logo_small.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
VivandaIconSmall.displayName = "VivandaIconSmall";

const WongIconSmall: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
        alt={"Wong"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
      //   alt={"Wong"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/wong_logo.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
WongIconSmall.displayName = "WongIconSmall";

const PlazaVeaPromoIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/oh-pay-icon-v4.png"
        alt={"Tarjeta Oh!"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/oh-pay-icon-v4.png"
      //   alt={"Tarjeta Oh!"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/oh-pay-icon-v4.png"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
PlazaVeaPromoIcon.displayName = "PlazaVeaPromoIcon";

const TottusPromoIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/cmrIcon.svg"
        alt={"Tarjeta CMR!"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/cmrIcon.svg"
      //   alt={"Tarjeta CMR!"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/cmrIcon.svg"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
TottusPromoIcon.displayName = "TottusPromoIcon";

const ChekaloLogoIcon: React.FC<IconProps> = React.memo(
  ({ className }: IconProps) => {
    return (
      <img
        src="https://cdn.poschuler.dev/chekalo/chekalo_logo.png"
        alt={"Chekalo"}
        className={className}
        loading="lazy"
        //effect="blur"
        //visibleByDefault={true}
      />

      // <AsyncImage
      //   src="https://cdn.poschuler.dev/chekalo/chekalo_logo.png"
      //   alt={"Chekalo"}
      //   Transition={(props) => <Blur radius={10} {...props} />}
      //   loader={<div style={{ background: "#888" }} />}
      // />

      // <img
      //   src="https://cdn.poschuler.dev/chekalo/chekalo_logo.png"
      //   alt=""
      //   className={className}
      //   loading="lazy"
      // />
    );
  }
);
ChekaloLogoIcon.displayName = "ChekaloLogoIcon";

export {
  PlazaVeaIcon,
  MetroIcon,
  TottusIcon,
  VivandaIcon,
  WongIcon,
  PlazaVeaIconSmall,
  MetroIconSmall,
  TottusIconSmall,
  VivandaIconSmall,
  WongIconSmall,
  PlazaVeaPromoIcon,
  TottusPromoIcon,
  ChekaloLogoIcon,
};
