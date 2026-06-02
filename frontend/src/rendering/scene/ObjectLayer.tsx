import type { SceneFrame } from '../../schema/sceneFrame';
import { VisualObject } from './VisualObject';

interface ObjectLayerProps {
  frame: SceneFrame;
}

export function ObjectLayer({ frame }: ObjectLayerProps) {
  return (
    <>
      {frame.objects.map(obj => (
        <VisualObject key={obj.object_id} obj={obj} />
      ))}
    </>
  );
}
