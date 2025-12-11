import { Link } from "react-router"
import clsx from "clsx"
import { ChekaloLogoIcon } from "~/components/icons"

type TitleLogoProps = {
    shouldHideONMobile?: boolean
}

export const TitleLogo = ({ shouldHideONMobile = false }: TitleLogoProps) => {
    return (
        <Link to="/" className="flex items-center gap-2 font-semibold">
            <ChekaloLogoIcon className="w-8" />
            <span className={clsx("text-2xl font-quicksand tracking-normal", shouldHideONMobile ? "hidden md:block" : "block")}>chekalo.pe</span>
        </Link >
    )
}