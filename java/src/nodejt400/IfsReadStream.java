package nodejt400;

import java.sql.Connection;
import java.util.Arrays;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileInputStream;

public class IfsReadStream {

	/**
	 * Size of the buffer handed to each IFSFileInputStream.read call.
	 *
	 * Every read is a round-trip to the IFS host server, so the buffer size
	 * decides how many round-trips a file costs: at 10 KB a one-megabyte file
	 * takes about a hundred of them, at 64 KB about sixteen. The larger
	 * buffer is a single allocation per stream and does not grow with file
	 * size.
	 *
	 * Override with the JT400_IFS_READ_BUFFER environment variable or the
	 * jt400.ifs.readBuffer system property. An unparsable or non-positive
	 * value falls back to the default rather than failing at class-init time.
	 */
	public static final int DEFAULT_BUFFER_SIZE = readDefaultBufferSize();

	private static final int FALLBACK_BUFFER_SIZE = 65536;

	private static int readDefaultBufferSize() {
		String configured = System.getenv("JT400_IFS_READ_BUFFER");
		if (configured == null) {
			configured = System.getProperty("jt400.ifs.readBuffer");
		}
		if (configured == null) {
			return FALLBACK_BUFFER_SIZE;
		}
		try {
			int parsed = Integer.parseInt(configured.trim());
			return parsed > 0 ? parsed : FALLBACK_BUFFER_SIZE;
		} catch (NumberFormatException ex) {
			return FALLBACK_BUFFER_SIZE;
		}
	}

	private ConnectionProvider connectionProvider;
	private final Connection connection;
	private int bufferSize = DEFAULT_BUFFER_SIZE;
	byte[] buffer = new byte[bufferSize];
	private final IFSFileInputStream fis;

	public IfsReadStream(ConnectionProvider connectionProvider, String fileName)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile file = new IFSFile(as400, fileName);
		fis = new IFSFileInputStream(file);
	}

	public byte[] read() throws Exception {
		int n = fis.read(buffer);
		if (n == -1) {
			fis.close();
			connectionProvider.returnConnection(connection);
			return null;
		} else if (n < bufferSize) {
			return Arrays.copyOf(buffer, n);
		}
		return buffer;

	}
}
