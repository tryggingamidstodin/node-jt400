package nodejt400;

import java.beans.PropertyVetoException;
import java.math.BigDecimal;
import java.sql.Connection;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.AS400JDBCConnectionPool;
import com.ibm.as400.access.AS400JDBCConnectionPoolDataSource;
import com.ibm.as400.access.AS400Message;
import com.ibm.as400.access.AS400PackedDecimal;
import com.ibm.as400.access.AS400Text;
import com.ibm.as400.access.ProgramCall;
import com.ibm.as400.access.ProgramParameter;
import com.ibm.as400.access.QSYSObjectPathName;

public class JT400 implements ConnectionProvider
{
	private final AS400JDBCConnectionPool sqlPool;

	private final JdbcJsonClient client;

	public JT400(JSONObject jsonConf)
	{
		Props conf = new Props(jsonConf);
		AS400JDBCConnectionPoolDataSource ds = new AS400JDBCConnectionPoolDataSource();
		ds.setServerName(conf.get("host"));
		ds.setUser(conf.get("user"));
		ds.setPassword(conf.get("password"));
		String naming = conf.get("naming", "system");
		ds.setNaming(naming);
		ds.setDateFormat(conf.get("dateFormat", "iso"));
		ds.setMetaDataSource(0);
		String value = conf.get("sort");
		if (value != null)
		{
			ds.setSort(value);
		}
		value = conf.get("sortTable");
		if (value != null)
		{
			ds.setSortTable(value);
		}
		value = conf.get("sortLanguage");
		if (value != null)
		{
			ds.setSortLanguage(value);
		}
		value = conf.get("libraries");
		if (value != null)
		{
			ds.setLibraries(value);
		}
		this.sqlPool = new AS400JDBCConnectionPool(ds);
		this.client = new JdbcJsonClient(this);
		Runtime.getRuntime().addShutdownHook(new Thread()
		{
			@Override
			public void run()
			{
				System.out.println("close connectionpool.");
				sqlPool.close();
			}
		});
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return sqlPool.getConnection();
	}

	public static final JT400 getInstance(String jsonConf)
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new JT400(conf);
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public ResultSetStream executeAsStream(String sql, String paramsJson, int bufferSize, boolean metadata)
			throws Exception
	{
		return client.executeAsStream(sql, paramsJson, bufferSize, metadata);
	}

	public TablesReadStream getTablesAsStream(String catalog, String schema, String table) throws Exception
	{
		return client.getTablesAsStream(catalog, schema, table);
	}

	public String getColumns(String catalog, String schema, String tableNamePattern, String columnNamePattern)
	throws Exception
	{
		return client.getColumns(catalog, schema, tableNamePattern, columnNamePattern);
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		return client.update(sql, paramsJson);
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception
	{
		return client.insertAndGetId(sql, paramsJson);
	}

	public void close()
	{
		sqlPool.close();
	}

	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(programName, paramsSchemaJsonStr);
	}

	public class Pgm
	{
		private final String name;

		private final PgmParam[] paramArray;

		public Pgm(String programName, String paramsSchemaJsonStr)
		{
			this.name = programName;
			JSONArray paramsSchema = (JSONArray) JSONValue.parse(paramsSchemaJsonStr);
			int n = paramsSchema.size();
			paramArray = new PgmParam[n];
			for (int i = 0; i < n; i++)
			{
				Props paramDef = new Props((JSONObject) paramsSchema.get(i));
				if ("decimal".equals(paramDef.get("type")) || paramDef.has("decimals"))
				{
					paramArray[i] = new DecimalPgmParam(paramDef);
				}
				else
				{
					paramArray[i] = new TextPgmParam(paramDef);
				}
			}
		}

		public String run(String paramsJsonStr) throws Exception
		{
			Connection c = sqlPool.getConnection();
			JSONObject result = new JSONObject();
			try
			{
				JSONObject params = (JSONObject) JSONValue.parse(paramsJsonStr);
				for (PgmParam param : paramArray)
				{
					param.setValue(params.get(param.getName()));
				}

				AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
				AS400 as400 = handle.getSystem();
				ProgramCall call = new ProgramCall(as400);

				//Run
				call.setProgram(QSYSObjectPathName.toPath("*LIBL", name, "PGM"), paramArray);
				if (!call.run())
				{
					AS400Message[] ms = call.getMessageList();
					StringBuffer error = new StringBuffer();
					error.append("Program ");
					error.append(call.getProgram());
					error.append(" did not run: ");
					for (int i = 0; i < ms.length; i++)
					{
						error.append(ms[i].toString());
						error.append("\n");
					}
					throw new Exception(error.toString());
				}

				//Get results
				for (PgmParam param : paramArray)
				{
					result.put(param.getName(), param.getValue());
				}

			}
			catch (Exception ex)
			{
				throw ex;
			}
			finally
			{
				c.close();
			}

			return result.toJSONString();

		}
	}
}

abstract class PgmParam extends ProgramParameter
{
	Props paramDef;

	public PgmParam(Props paramDef)
	{
		super(paramDef.getInt("size"));
		this.paramDef = paramDef;
	}

	public String getName()
	{
		return paramDef.get("name");
	}

	public abstract void setValue(Object value) throws PropertyVetoException;

	public abstract Object getValue();
}

class TextPgmParam extends PgmParam
{
	private final AS400Text parser;

	public TextPgmParam(Props paramDef)
	{
		super(paramDef);
		parser = new AS400Text(paramDef.getInt("size"), "Cp871");
	}

	@Override
	public void setValue(Object value) throws PropertyVetoException
	{
		super.setInputData(parser.toBytes(value == null ? "" : value));
	}

	@Override
	public Object getValue()
	{
		return ((String) parser.toObject(super.getOutputData())).trim();
	}
}

class DecimalPgmParam extends PgmParam
{
	private final AS400PackedDecimal parser;

	public DecimalPgmParam(Props paramDef)
	{
		super(paramDef);
		parser = new AS400PackedDecimal(paramDef.getInt("size"), paramDef.getInt("decimals"));
	}

	@Override
	public void setValue(Object value) throws PropertyVetoException
	{
		super.setInputData(parser.toBytes(new BigDecimal(value == null ? "0" : value.toString())));
	}

	@Override
	public Object getValue()
	{
		return parser.toObject(super.getOutputData());
	}
}

class Props
{
	private final JSONObject w;

	public Props(JSONObject w)
	{
		this.w = w;
	}

	public boolean has(String key)
	{
		return w.get(key) != null;
	}

	public String get(String key)
	{
		return (String) w.get(key);
	}

	public int getInt(String key)
	{
		return ((Number) w.get(key)).intValue();
	}

	public String get(String key, String defaultValue)
	{
		String value = (String) w.get(key);
		return value == null ? defaultValue : value;
	}
}