import { Link, Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import {
  FacebookIcon,
  TelegramIcon,
  WhatsappIcon,
  XIcon,
  FacebookShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappShareButton,
} from "react-share";
import { useBaseUrl } from "~/utils/misc";
import slug from "slug";
import { useToast } from "~/components/ui/use-toast";
import { Button as ChekaloButton } from "~/components/chekalo/Button"

type ShareButtonProps = {
  idMasterProduct: string;
  productName: string;
};

export default function CardShareButton({
  idMasterProduct,
  productName,
}: ShareButtonProps) {
  const baseUrl = useBaseUrl();
  const { toast } = useToast();
  const url = `${baseUrl}/${slug(`${idMasterProduct} ${productName}`)}/p`;

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <ChekaloButton className={"flex items-center"}>
            <Share2 className="mr-2" size={15} />
            Compartir
          </ChekaloButton>
          {/* <Button variant={"default"} size={"icon"} className={cn("flex-grow")}>
            <Share1Icon />
          </Button> */}
        </DialogTrigger>
        <DialogContent className="max-w-[280px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Compartir</DialogTitle>
            <DialogDescription className="sr-only">
              Compartir producto en redes sociales
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 content-evenly items-center justify-evenly justify-items-center gap-4">
            <WhatsappShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <WhatsappIcon size={32} round={true} />
            </WhatsappShareButton>

            <FacebookShareButton
              url={url}
              hashtag="#chekalo"
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <FacebookIcon size={32} round={true} />
            </FacebookShareButton>

            <TelegramShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
            >
              <TelegramIcon size={32} round={true} />
            </TelegramShareButton>

            <TwitterShareButton
              url={url}
              title="Cheka esta oferta que encontré en chekalo.pe"
              hashtags={["chekalo"]}
            >
              <XIcon size={32} round={true} />
            </TwitterShareButton>

            <Button variant={"outline"} size={"icon"} className="rounded-full" onClick={() => {
              navigator.clipboard.writeText(url)
              toast({
                description: "Se copió el enlace",
                duration: 500,
              }
              );
            }
            }>
              <Link size={20} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
