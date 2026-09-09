/**
 * Registro central de ícones — Phosphor Icons.
 *
 * Usamos o entry `/dist/ssr`, que não depende de React Context e portanto
 * funciona tanto em Server Components quanto em Client Components (App Router).
 *
 * Os nomes são exportados com os aliases usados no código (herdados do lucide)
 * para manter as chamadas JSX existentes; à direita fica o ícone Phosphor real.
 * Para adicionar um ícone novo, importe de `@phosphor-icons/react/dist/ssr`.
 */
export {
  // Navegação / setas
  ArrowRight,
  CaretDown as ChevronDownIcon,
  CaretUp as ChevronUpIcon,
  CaretLeft as ChevronLeft,
  CaretLeft as ChevronLeftIcon,
  CaretRight as ChevronRight,
  CaretRight as ChevronRightIcon,
  DotsThree as MoreHorizontalIcon,
  List as Menu,

  // Ações
  MagnifyingGlass as Search,
  MagnifyingGlass as SearchIcon,
  Copy,
  Trash as Trash2,
  PencilSimple as Pencil,
  Plus,
  Minus,
  Minus as MinusIcon,
  ArrowsClockwise as RefreshCw,
  X as XIcon,
  SignOut as LogOut,

  // Status / feedback
  Check,
  Check as CheckIcon,
  CheckCircle as CheckCircle2,
  CheckCircle as CircleCheckIcon,
  XCircle,
  Info as InfoIcon,
  Warning as TriangleAlertIcon,
  WarningOctagon as OctagonXIcon,
  CircleNotch as Loader2,
  CircleNotch as Loader2Icon,

  // Comércio / conta
  ShoppingBag,
  CreditCard,
  Tag,
  Truck,
  Package,
  Package as PackageOpen,
  MapPin,
  User,
  Lock,
  Key as KeyRound,
  QrCode,
  Envelope as Mail,
  ShieldCheck,
  Gear as Settings,
  SquaresFour as LayoutDashboard,
  ListChecks,
  Pause,
  SkipForward,
} from "@phosphor-icons/react/dist/ssr";
