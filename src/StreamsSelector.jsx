import React, { memo, Fragment } from 'react';

import { FaVideo, FaVideoSlash, FaFileExport, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaTrashAlt, FaInfoCircle } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import Swal from 'sweetalert2';
import { SegmentedControl } from 'evergreen-ui';
import withReactContent from 'sweetalert2-react-content';
import { useTranslation } from 'react-i18next';

import { formatDuration } from './util';
import { getStreamFps } from './ffmpeg';

const ReactSwal = withReactContent(Swal);


function onInfoClick(s, title) {
  ReactSwal.fire({
    showCloseButton: true,
    title,
    html: <div style={{ whiteSpace: 'pre', textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'auto' }}>{JSON.stringify(s, null, 2)}</div>,
  });
}

const Stream = memo(({ stream, onToggle, copyStream, fileDuration }) => {
  const { t } = useTranslation();

  const bitrate = parseInt(stream.bit_rate, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon;
  if (stream.codec_type === 'audio') {
    Icon = copyStream ? FaVolumeUp : FaVolumeMute;
  } else if (stream.codec_type === 'video') {
    Icon = copyStream ? FaVideo : FaVideoSlash;
  } else if (stream.codec_type === 'subtitle') {
    Icon = copyStream ? MdSubtitles : FaBan;
  } else {
    Icon = copyStream ? GoFileBinary : FaBan;
  }

  const streamFps = getStreamFps(stream);

  const onClick = () => onToggle && onToggle(stream.index);

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td><Icon size={20} style={{ padding: '0 5px', cursor: 'pointer' }} role="button" onClick={onClick} /></td>
      <td>{stream.index}</td>
      <td>{stream.codec_type}</td>
      <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
      <td>{stream.codec_name}</td>
      <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration })}`}</td>
      <td>{stream.nb_frames}</td>
      <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit/s`}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
      <td><FaInfoCircle role="button" onClick={() => onInfoClick(stream, t('Stream info'))} size={26} /></td>
    </tr>
  );
});

const FileRow = ({ path, formatData, onTrashClick }) => {
  const { t } = useTranslation();

  return (
    <tr>
      <td>{onTrashClick && <FaTrashAlt size={20} role="button" style={{ padding: '0 5px', cursor: 'pointer' }} onClick={onTrashClick} />}</td>
      <td colSpan={8} title={path} style={{ wordBreak: 'break-all', fontWeight: 'bold' }}>{path.replace(/.*\/([^/]+)$/, '$1')}</td>
      <td><FaInfoCircle role="button" onClick={() => onInfoClick(formatData, t('File info'))} size={26} /></td>
    </tr>
  );
};

const StreamsSelector = memo(({
  mainFilePath, mainFileFormatData, streams: existingStreams, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractAllStreamsPress, externalFiles, setExternalFiles,
  showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams,
  AutoExportToggler,
}) => {
  const { t } = useTranslation();

  if (!existingStreams) return null;

  function getFormatDuration(formatData) {
    if (!formatData || !formatData.duration) return undefined;
    const parsed = parseFloat(formatData.duration, 10);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  async function removeFile(path) {
    setCopyStreamIdsForPath(path, () => ({}));
    setExternalFiles((old) => {
      const { [path]: val, ...rest } = old;
      return rest;
    });
  }

  const externalFilesEntries = Object.entries(externalFiles);

  return (
    <div style={{ color: 'black', padding: 10 }}>
      <p>{t('Click to select which tracks to keep when exporting:')}</p>

      <table style={{ marginBottom: 10 }}>
        <thead style={{ background: 'rgba(0,0,0,0.1)' }}>
          <tr>
            <th>{t('Keep?')}</th>
            <th />
            <th>{t('Type')}</th>
            <th>{t('Tag')}</th>
            <th>{t('Codec')}</th>
            <th>{t('Duration')}</th>
            <th>{t('Frames')}</th>
            <th>{t('Bitrate')}</th>
            <th>{t('Data')}</th>
            <th />
          </tr>
        </thead>

        <tbody>
          <FileRow path={mainFilePath} formatData={mainFileFormatData} />

          {existingStreams.map((stream) => (
            <Stream
              key={stream.index}
              stream={stream}
              copyStream={isCopyingStreamId(mainFilePath, stream.index)}
              onToggle={(streamId) => toggleCopyStreamId(mainFilePath, streamId)}
              fileDuration={getFormatDuration(mainFileFormatData)}
            />
          ))}

          {externalFilesEntries.map(([path, { streams, formatData }]) => (
            <Fragment key={path}>
              <tr><td colSpan={10} /></tr>

              <FileRow path={path} formatData={formatData} onTrashClick={() => removeFile(path)} />

              {streams.map((stream) => (
                <Stream
                  key={stream.index}
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
                  fileDuration={getFormatDuration(formatData)}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      {externalFilesEntries.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div>
            {t('When tracks have different lengths, do you want to make the output file as long as the longest or the shortest track?')}
          </div>
          <SegmentedControl
            options={[{ label: t('Longest'), value: 'longest' }, { label: t('Shortest'), value: 'shortest' }]}
            value={shortestFlag ? 'shortest' : 'longest'}
            onChange={value => setShortestFlag(value === 'shortest')}
          />

        </div>
      )}

      {nonCopiedExtraStreams.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          {t('Discard or extract unprocessable tracks to separate files?')}
          <AutoExportToggler />
        </div>
      )}

      <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={showAddStreamSourceDialog}>
        <FaFileImport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> {t('Include more tracks from other file')}
      </div>

      {externalFilesEntries.length === 0 && (
        <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={onExtractAllStreamsPress}>
          <FaFileExport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> {t('Export each track as individual files')}
        </div>
      )}
    </div>
  );
});

export default StreamsSelector;
