import MapApp from "@/components/MapApp";
import EmergencyBar from "@/components/EmergencyBar";

export default function Home() {
  return (
    <>
      <EmergencyBar />
      <h1 className="sr">Nepal Flood &amp; Landslide Watch</h1>
      <MapApp />
    </>
  );
}
